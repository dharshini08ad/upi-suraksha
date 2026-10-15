"""End-to-end tests for the simulated UPI wallet (auth, wallet, contacts, payments).

Every user handle is made unique per run so re-runs against a persistent DB
never collide.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from backend import simulator
from backend.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clear_rate_limits() -> None:
    """Tests share one client IP, so clear the sliding-window limiters between
    tests to avoid 429s from the auth/pay rate caps."""
    simulator.auth_limiter.reset()
    simulator.pay_limiter.reset()


def _unique(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:10]}"


def _register(prefix: str = "user") -> tuple[dict, dict]:
    """Register a fresh user and return (headers, user_payload)."""
    username = _unique(prefix)
    response = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "password": "Passw0rd!",
            "display_name": f"Test {prefix}",
            "phone": "9876543210",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    return {"Authorization": f"Bearer {body['token']}"}, body["user"]


def test_register_login_and_me_round_trip() -> None:
    headers, user = _register("round")
    assert user["username"].startswith("round")

    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["id"] == user["id"]

    login = client.post(
        "/api/auth/login",
        json={"username": user["username"], "password": "Passw0rd!"},
    )
    assert login.status_code == 200
    new_headers = {"Authorization": f"Bearer {login.json()['token']}"}
    assert client.get("/api/auth/me", headers=new_headers).json()["id"] == user["id"]


def test_bad_password_is_rejected() -> None:
    _, user = _register("badpw")
    response = client.post(
        "/api/auth/login",
        json={"username": user["username"], "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_duplicate_username_conflicts() -> None:
    _, user = _register("dupe")
    response = client.post(
        "/api/auth/register",
        json={
            "username": user["username"],
            "password": "Passw0rd!",
            "display_name": "Impostor",
        },
    )
    assert response.status_code == 409


def test_unauthenticated_requests_are_rejected() -> None:
    assert client.get("/api/wallet").status_code == 401
    assert client.get("/api/contacts").status_code == 401
    assert client.get("/api/payments").status_code == 401
    assert (
        client.get("/api/auth/me", headers={"Authorization": "Bearer bogus"}).status_code
        == 401
    )


def test_wallet_starts_at_50k_and_is_simulated() -> None:
    headers, _ = _register("wallet")
    response = client.get("/api/wallet", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["balance"] == 5_000_000  # ₹50,000 stored as paise
    assert body["currency"] == "INR"
    assert body["simulated"] is True
    assert "demo wallet" in body["note"].lower()



def test_payment_debits_wallet_and_appears_in_history() -> None:
    headers, _ = _register("pay")
    before = client.get("/api/wallet", headers=headers).json()["balance"]

    response = client.post(
        "/api/payments",
        headers=headers,
        json={
            "receiver_upi_id": "clean@okaxis",
            "amount": 150_000,
            "note": "lunch split",
            "idempotency_key": uuid.uuid4().hex,
        },
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["status"] == "completed"
    assert result["amount"] == 150_000
    assert result["recommended_action"] == "ALLOW"
    assert result["simulated"] is True
    assert result["balance_after"] == before - 150_000

    wallet = client.get("/api/wallet", headers=headers).json()
    assert wallet["balance"] == before - 150_000

    history = client.get("/api/payments", headers=headers).json()
    assert len(history) == 1
    assert history[0]["reference"] == result["reference"]

    detail = client.get(f"/api/payments/{result['reference']}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["reference"] == result["reference"]


def test_insufficient_funds_is_rejected() -> None:
    headers, _ = _register("poor")
    response = client.post(
        "/api/payments",
        headers=headers,
        json={
            "receiver_upi_id": "clean@okaxis",
            "amount": 6_000_000,  # ₹60,000 > ₹50,000 balance, within schema cap
            "idempotency_key": uuid.uuid4().hex,
        },
    )
    assert response.status_code == 400
    assert client.get("/api/wallet", headers=headers).json()["balance"] == 5_000_000


def test_duplicate_idempotency_key_conflicts() -> None:
    headers, _ = _register("idem")
    key = uuid.uuid4().hex
    payload = {
        "receiver_upi_id": "clean@okaxis",
        "amount": 100_000,
        "idempotency_key": key,
    }
    first = client.post("/api/payments", headers=headers, json=payload)
    assert first.status_code == 200
    second = client.post("/api/payments", headers=headers, json=payload)
    assert second.status_code == 409
    assert client.get("/api/wallet", headers=headers).json()["balance"] == 4_900_000


def test_high_risk_payment_is_blocked_with_evidence() -> None:
    headers, _ = _register("block")
    response = client.post(
        "/api/payments",
        headers=headers,
        json={
            "receiver_upi_id": "kyc.verify.urgent.refund@ybl",
            "amount": 50_000,
            "idempotency_key": uuid.uuid4().hex,
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "blocked"
    assert result["recommended_action"] == "BLOCK"
    assert result["risk_level"] == "HIGH"
    assert result["simulated"] is True
    assert client.get("/api/wallet", headers=headers).json()["balance"] == 5_000_000
    history = client.get("/api/payments", headers=headers).json()
    assert len(history) == 1
    assert history[0]["reference"] == result["reference"]
    assert history[0]["analysis"]["reasons"]


def test_forced_high_risk_payment_records_blocked_without_debit() -> None:
    headers, _ = _register("force")
    response = client.post(
        "/api/payments",
        headers=headers,
        json={
            "receiver_upi_id": "kyc.verify.urgent.refund@ybl",
            "amount": 50_000,
            "confirm_risk": True,
            "idempotency_key": uuid.uuid4().hex,
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "blocked"
    assert result["risk_level"] == "HIGH"
    assert client.get("/api/wallet", headers=headers).json()["balance"] == 5_000_000


def test_medium_risk_requires_explicit_confirmation() -> None:
    headers, _ = _register("confirm")
    payload = {
        "receiver_upi_id": "refund@okaxis",
        "amount": 25_000,
        "idempotency_key": uuid.uuid4().hex,
    }
    review = client.post("/api/payments", headers=headers, json=payload)
    assert review.status_code == 409
    assert review.json()["detail"]["recommended_action"] == "WARN_AND_VERIFY"
    assert client.get("/api/wallet", headers=headers).json()["balance"] == 5_000_000

    payload["confirm_risk"] = True
    confirmed = client.post("/api/payments", headers=headers, json=payload)
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "completed"
    assert confirmed.json()["recommended_action"] == "WARN_AND_VERIFY"
    assert client.get("/api/wallet", headers=headers).json()["balance"] == 4_975_000


def test_qr_payment_keeps_warning_evidence_and_requires_confirmation() -> None:
    headers, _ = _register("qrconfirm")
    payload = {
        "receiver_upi_id": "clean@okaxis",
        "receiver_name": "Local shop",
        "amount": 10_000,
        "risk_payload": "upi://pay?pa=clean%40okaxis&pn=Local%20shop&tn=OTP%20PIN&am=100.00",
        "idempotency_key": uuid.uuid4().hex,
    }
    review = client.post("/api/payments", headers=headers, json=payload)
    assert review.status_code == 409
    assert review.json()["detail"]["recommended_action"] == "WARN_AND_VERIFY"
    assert client.get("/api/wallet", headers=headers).json()["balance"] == 5_000_000

    payload["confirm_risk"] = True
    confirmed = client.post("/api/payments", headers=headers, json=payload)
    assert confirmed.status_code == 200
    assert "OTP" in " ".join(confirmed.json()["reasons"])


def test_qr_payment_rejects_recipient_and_amount_mismatches() -> None:
    headers, _ = _register("qrmismatch")
    payload = {
        "receiver_upi_id": "other@okaxis",
        "amount": 10_000,
        "risk_payload": "upi://pay?pa=clean%40okaxis&am=100.00",
        "idempotency_key": uuid.uuid4().hex,
    }
    recipient_mismatch = client.post("/api/payments", headers=headers, json=payload)
    assert recipient_mismatch.status_code == 422
    assert client.get("/api/wallet", headers=headers).json()["balance"] == 5_000_000

    payload["receiver_upi_id"] = "clean@okaxis"
    payload["amount"] = 20_000
    amount_mismatch = client.post("/api/payments", headers=headers, json=payload)
    assert amount_mismatch.status_code == 422
    assert "amount" in amount_mismatch.json()["detail"].lower()
    assert client.get("/api/wallet", headers=headers).json()["balance"] == 5_000_000


def test_contacts_are_saved_listed_searched_and_deleted() -> None:
    headers, _ = _register("contact")
    created = client.post(
        "/api/contacts",
        headers=headers,
        json={"name": "Priya Nair", "upi_id": "priya@okhdfc", "phone": "9811111111"},
    )
    assert created.status_code == 200, created.text
    contact = created.json()
    assert contact["upi_id"] == "priya@okhdfc"

    assert len(client.get("/api/contacts", headers=headers).json()) == 1
    searched = client.get("/api/contacts?q=pri", headers=headers).json()
    assert len(searched) == 1
    assert searched[0]["name"] == "Priya Nair"
    directory = client.get("/api/contacts/search?q=priya", headers=headers).json()
    assert len(directory) == 1

    deleted = client.delete(f"/api/contacts/{contact['id']}", headers=headers)
    assert deleted.status_code == 200
    assert client.get("/api/contacts", headers=headers).json() == []


def test_logout_invalidates_the_session() -> None:
    headers, _ = _register("logout")
    assert client.post("/api/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/wallet", headers=headers).status_code == 401

"""Data-access layer for the simulated wallet.

All SQL lives here, parameterised. Balance mutations are transaction-safe and
idempotency-aware (duplicate payments are rejected inside the transaction).

Nothing in this module talks to a real bank, UPI switch, or telecom registry.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass

from backend import db
from backend.security import hash_password, verify_password

# A brand-new simulated wallet starts with 50,000 rupees (= 5,000,000 paise).
WALLET_INITIAL_PAISE = 5_000_000
SESSION_TTL_SECONDS = 60 * 60 * 12  # 12 hours


class StoreError(Exception):
    status_code = 400
    code = "bad_request"


class ValidationError(StoreError):
    status_code = 400
    code = "validation_error"


class AuthError(StoreError):
    status_code = 401
    code = "unauthorized"


class NotFoundError(StoreError):
    status_code = 404
    code = "not_found"


class ConflictError(StoreError):
    status_code = 409
    code = "conflict"


class InsufficientFundsError(StoreError):
    status_code = 400
    code = "insufficient_funds"


class DuplicatePaymentError(StoreError):
    status_code = 409
    code = "duplicate_transaction"


# --------------------------------------------------------------------------
# Users & sessions
# --------------------------------------------------------------------------


def create_user(username: str, password: str, display_name: str, phone: str | None) -> dict:
    now = time.time()
    pw_hash, pw_salt = hash_password(password)
    user_id = db.new_id("U")
    try:
        with db.write_txn() as conn:
            conn.execute(
                "INSERT INTO users (id, username, password_hash, password_salt, display_name, phone, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, username, pw_hash, pw_salt, display_name, phone, now),
            )
            conn.execute(
                "INSERT INTO wallets (user_id, balance, updated_at) VALUES (?, ?, ?)",
                (user_id, WALLET_INITIAL_PAISE, now),
            )
    except Exception as exc:
        if "UNIQUE" in str(exc):
            raise ConflictError("That username is already registered.") from exc
        raise
    db.audit(user_id, "user.register", username)
    return {"id": user_id, "username": username, "display_name": display_name}


def authenticate(username: str, password: str) -> dict:
    conn = db.get_conn()
    row = conn.execute(
        "SELECT * FROM users WHERE username = ?", (username.strip().casefold(),)
    ).fetchone()
    if row is None or not verify_password(password, row["password_hash"], row["password_salt"]):
        db.audit(None, "auth.login_failed", username)
        raise AuthError("Invalid username or password.")
    return {
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "phone": row["phone"],
    }


def create_session(user_id: str) -> str:
    from backend.security import hash_token, new_token

    token = new_token()
    now = time.time()
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (hash_token(token), user_id, now, now + SESSION_TTL_SECONDS),
    )
    conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
    conn.commit()
    return token


def resolve_session(token: str) -> dict:
    from backend.security import hash_token

    if not token:
        raise AuthError("Missing session token.")
    conn = db.get_conn()
    row = conn.execute(
        "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id"
        " WHERE s.token_hash = ? AND s.expires_at > ?",
        (hash_token(token), time.time()),
    ).fetchone()
    if row is None:
        raise AuthError("Session expired or invalid.")
    return {
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "phone": row["phone"],
    }


def destroy_session(token: str) -> None:
    from backend.security import hash_token

    conn = db.get_conn()
    conn.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(token),))
    conn.commit()



# --------------------------------------------------------------------------
# Wallet
# --------------------------------------------------------------------------


def get_balance(user_id: str) -> int:
    conn = db.get_conn()
    row = conn.execute("SELECT balance FROM wallets WHERE user_id = ?", (user_id,)).fetchone()
    return int(row["balance"]) if row else 0


# --------------------------------------------------------------------------
# Contacts
# --------------------------------------------------------------------------


def list_contacts(user_id: str, query: str = "") -> list[dict]:
    conn = db.get_conn()
    q = f"%{query.strip()}%"
    if query.strip():
        rows = conn.execute(
            "SELECT * FROM contacts WHERE user_id = ?"
            " AND (name LIKE ? OR upi_id LIKE ? OR COALESCE(phone, '') LIKE ?)"
            " ORDER BY name COLLATE NOCASE",
            (user_id, q, q, q),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM contacts WHERE user_id = ? ORDER BY name COLLATE NOCASE",
            (user_id,),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "upi_id": r["upi_id"],
            "phone": r["phone"],
            "verified": bool(r["verified"]),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


def upsert_contact(
    user_id: str, name: str, upi_id: str, phone: str | None, verified: bool = False
) -> dict:
    conn = db.get_conn()
    existing = conn.execute(
        "SELECT id FROM contacts WHERE user_id = ? AND upi_id = ?", (user_id, upi_id)
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE contacts SET name = ?, phone = ?, verified = ? WHERE id = ?",
            (name, phone, 1 if verified else 0, existing["id"]),
        )
        conn.commit()
        contact_id = existing["id"]
    else:
        contact_id = db.new_id("C")
        conn.execute(
            "INSERT INTO contacts (id, user_id, name, upi_id, phone, verified, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (contact_id, user_id, name, upi_id, phone, 1 if verified else 0, time.time()),
        )
        conn.commit()
    return {
        "id": contact_id,
        "name": name,
        "upi_id": upi_id,
        "phone": phone,
        "verified": verified,
    }


def delete_contact(user_id: str, contact_id: str) -> None:
    conn = db.get_conn()
    cur = conn.execute(
        "DELETE FROM contacts WHERE id = ? AND user_id = ?", (contact_id, user_id)
    )
    conn.commit()
    if cur.rowcount == 0:
        raise NotFoundError("Contact not found.")



# --------------------------------------------------------------------------
# Transactions (transaction-safe balance updates + idempotency)
# --------------------------------------------------------------------------


@dataclass
class PaymentResult:
    reference: str
    id: str
    status: str
    amount: int
    balance_after: int


def execute_payment(
    sender_id: str,
    receiver_upi_id: str,
    receiver_name: str | None,
    amount_paise: int,
    note: str | None,
    idempotency_key: str | None,
    risk: dict | None,
) -> PaymentResult:
    """Debit the sender inside a single IMMEDIATE transaction.

    The balance is re-read *inside* the write transaction so two concurrent
    spends can never overdraw. Duplicate idempotency keys are rejected before
    any state changes.
    """
    if amount_paise <= 0:
        raise ValidationError("Amount must be greater than zero.")

    now = time.time()
    txn_id = db.new_id("T")
    reference = db.new_id("R")
    status = "completed"
    if risk and risk.get("recommended_action") == "BLOCK":
        status = "blocked"

    with db.write_txn() as conn:
        if idempotency_key:
            dup = conn.execute(
                "SELECT id, reference FROM transactions WHERE sender_id = ? AND idempotency_key = ?",
                (sender_id, idempotency_key),
            ).fetchone()
            if dup:
                raise DuplicatePaymentError(
                    f"Transaction {dup['reference']} was already submitted."
                )
        row = conn.execute(
            "SELECT balance FROM wallets WHERE user_id = ?", (sender_id,)
        ).fetchone()
        if row is None:
            raise NotFoundError("Wallet not found.")
        balance = int(row["balance"])
        if status == "completed" and balance < amount_paise:
            raise InsufficientFundsError("Insufficient simulated balance.")
        if status == "completed":
            balance -= amount_paise
            conn.execute(
                "UPDATE wallets SET balance = ?, updated_at = ? WHERE user_id = ?",
                (balance, now, sender_id),
            )
        conn.execute(
            "INSERT INTO transactions (id, reference, sender_id, receiver_upi_id, receiver_name,"
            " amount, note, status, risk_score, risk_level, recommended_action, analysis_json,"
            " idempotency_key, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                txn_id,
                reference,
                sender_id,
                receiver_upi_id,
                receiver_name,
                amount_paise,
                note,
                status,
                (risk or {}).get("risk_score"),
                (risk or {}).get("risk_level"),
                (risk or {}).get("recommended_action"),
                json.dumps(risk) if risk else None,
                idempotency_key,
                now,
            ),
        )

    db.audit(sender_id, "payment.create", f"{reference} {receiver_upi_id} {amount_paise}")
    return PaymentResult(reference, txn_id, status, amount_paise, balance)



def list_transactions(user_id: str, query: str = "", limit: int = 100) -> list[dict]:
    conn = db.get_conn()
    q = f"%{query.strip()}%"
    if query.strip():
        rows = conn.execute(
            "SELECT * FROM transactions WHERE sender_id = ?"
            " AND (receiver_upi_id LIKE ? OR COALESCE(receiver_name, '') LIKE ?"
            "      OR reference LIKE ? OR COALESCE(note, '') LIKE ?)"
            " ORDER BY created_at DESC LIMIT ?",
            (user_id, q, q, q, q, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM transactions WHERE sender_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [_txn_dict(r) for r in rows]


def get_transaction(user_id: str, reference: str) -> dict:
    conn = db.get_conn()
    row = conn.execute(
        "SELECT * FROM transactions WHERE sender_id = ? AND reference = ?",
        (user_id, reference),
    ).fetchone()
    if row is None:
        raise NotFoundError("Transaction not found.")
    return _txn_dict(row)


def _txn_dict(row) -> dict:
    analysis = None
    if row["analysis_json"]:
        try:
            analysis = json.loads(row["analysis_json"])
        except Exception:
            analysis = None
    return {
        "id": row["id"],
        "reference": row["reference"],
        "receiver_upi_id": row["receiver_upi_id"],
        "receiver_name": row["receiver_name"],
        "amount": row["amount"],
        "note": row["note"],
        "status": row["status"],
        "risk_score": row["risk_score"],
        "risk_level": row["risk_level"],
        "recommended_action": row["recommended_action"],
        "analysis": analysis,
        "created_at": row["created_at"],
        "simulated": True,
    }

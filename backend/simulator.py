"""FastAPI router for the simulated UPI wallet: auth, wallet, contacts, payments.

Every payment is run through the existing :class:`RiskAnalyzer` *server-side*
before money moves. A ``BLOCK`` verdict prevents the debit and the transaction
is recorded as ``blocked``; a ``WARN_AND_VERIFY`` verdict proceeds only when
the caller explicitly confirms. Nothing here moves real money.

Security posture:
* Bearer sessions (hashed at rest) resolved server-side.
* Sliding-window rate limits on auth and payment endpoints.
* All input validated by Pydantic models; all SQL parameterised (store layer).
* Audit log written for register / login / payment / contact events.
"""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from backend import store
from backend.engine import RiskAnalyzer
from backend.security import RateLimiter
from backend.sim_schemas import (
    AuthResponse,
    ContactIn,
    ContactOut,
    LoginRequest,
    PaymentOut,
    PaymentRequest,
    RegisterRequest,
    TransactionOut,
    UserOut,
    WalletOut,
)

router = APIRouter(prefix="/api", tags=["simulator"])

analyzer = RiskAnalyzer()

auth_limiter = RateLimiter(max_events=10, window_seconds=60)
pay_limiter = RateLimiter(max_events=20, window_seconds=60)


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _rate_limit(limiter: RateLimiter, request: Request, scope: str) -> None:
    if not limiter.allow(f"{scope}:{_client_key(request)}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")


def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer session token.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        return store.resolve_session(token)
    except store.AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


def _user_out(u: dict) -> UserOut:
    return UserOut(
        id=u["id"],
        username=u["username"],
        display_name=u["display_name"],
        phone=u.get("phone"),
    )


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------


@router.post("/auth/register", response_model=AuthResponse)
def register(body: RegisterRequest, request: Request) -> AuthResponse:
    _rate_limit(auth_limiter, request, "register")
    try:
        user = store.create_user(
            body.username.casefold(), body.password, body.display_name, body.phone
        )
    except store.ConflictError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    enriched = dict(user)
    enriched.setdefault("phone", body.phone)
    token = store.create_session(user["id"])
    return AuthResponse(token=token, user=_user_out(enriched))


@router.post("/auth/login", response_model=AuthResponse)
def login(body: LoginRequest, request: Request) -> AuthResponse:
    _rate_limit(auth_limiter, request, "login")
    try:
        user = store.authenticate(body.username, body.password)
    except store.AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    token = store.create_session(user["id"])
    return AuthResponse(token=token, user=_user_out(user))


@router.post("/auth/logout")
def logout(
    authorization: str | None = Header(default=None),
    user: dict = Depends(current_user),
) -> dict:
    if authorization and authorization.lower().startswith("bearer "):
        store.destroy_session(authorization.split(" ", 1)[1].strip())
    return {"status": "ok"}


@router.get("/auth/me", response_model=UserOut)
def me(user: dict = Depends(current_user)) -> UserOut:
    return _user_out(user)


# --------------------------------------------------------------------------
# Wallet
# --------------------------------------------------------------------------


@router.get("/wallet", response_model=WalletOut)
def wallet(user: dict = Depends(current_user)) -> WalletOut:
    return WalletOut(balance=store.get_balance(user["id"]))


# --------------------------------------------------------------------------
# Contacts
# --------------------------------------------------------------------------


@router.get("/contacts", response_model=list[ContactOut])
def contacts(q: str = "", user: dict = Depends(current_user)) -> list[ContactOut]:
    return [ContactOut(**c, source="saved_contact") for c in store.list_contacts(user["id"], q)]


@router.post("/contacts", response_model=ContactOut)
def save_contact(body: ContactIn, user: dict = Depends(current_user)) -> ContactOut:
    saved = store.upsert_contact(
        user["id"], body.name, body.upi_id, body.phone, body.verified
    )
    db_audit = f"contact.save {body.upi_id}"
    from backend import db as _db

    _db.audit(user["id"], "contact.save", db_audit)
    return ContactOut(**saved, source="saved_contact")


@router.delete("/contacts/{contact_id}")
def remove_contact(contact_id: str, user: dict = Depends(current_user)) -> dict:
    store.delete_contact(user["id"], contact_id)
    from backend import db as _db

    _db.audit(user["id"], "contact.delete", f"contact.delete {contact_id}")
    return {"status": "deleted", "id": contact_id, "simulated": True}


# --------------------------------------------------------------------------
# Payments (fraud-checked, transaction-safe, idempotent)
# --------------------------------------------------------------------------


@router.post("/payments", response_model=PaymentOut)
def create_payment(
    body: PaymentRequest, request: Request, user: dict = Depends(current_user)
) -> PaymentOut:
    _rate_limit(pay_limiter, request, "payment")

    # Prefer the full scanned request so QR notes and embedded links are scored.
    analysis = (
        analyzer.analyze_qr_payload(body.risk_payload)
        if body.risk_payload
        else analyzer.analyze_upi(body.receiver_upi_id)
    )
    analyzed_upi = analysis.recipient_info.upi_id
    if not analyzed_upi or analyzed_upi.casefold() != body.receiver_upi_id.casefold():
        raise HTTPException(
            status_code=422,
            detail="The analyzed payment request does not match the submitted recipient UPI ID.",
        )
    qr_amount = analysis.recipient_info.amount
    if qr_amount is not None and int(round(qr_amount * 100)) != body.amount:
        raise HTTPException(
            status_code=422,
            detail="The submitted amount does not match the amount encoded in the payment QR.",
        )
    risk = {
        "risk_score": analysis.risk_score,
        "risk_level": analysis.risk_level,
        "recommended_action": analysis.recommended_action,
        "detected_threats": analysis.detected_threats,
        "reasons": analysis.reasons,
        "assessed_at": time.time(),
        "basis": "heuristic_rules",  # heuristic, not verified identity
        "simulated": True,
    }

    if analysis.recommended_action == "WARN_AND_VERIFY" and not body.confirm_risk:
        from backend import db as _db

        _db.audit(user["id"], "payment.confirmation_required", body.receiver_upi_id)
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Confirm the payee independently before submitting this medium-risk simulated payment.",
                "risk_score": analysis.risk_score,
                "risk_level": analysis.risk_level,
                "recommended_action": analysis.recommended_action,
                "detected_threats": analysis.detected_threats,
                "reasons": analysis.reasons,
                "simulated": True,
            },
        )

    receiver_name = body.receiver_name
    if not receiver_name and analysis.recipient_info:
        receiver_name = analysis.recipient_info.payee_name

    try:
        result = store.execute_payment(
            sender_id=user["id"],
            receiver_upi_id=body.receiver_upi_id,
            receiver_name=receiver_name,
            amount_paise=body.amount,
            note=body.note,
            idempotency_key=body.idempotency_key,
            risk=risk,
        )
    except store.DuplicatePaymentError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except store.StoreError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    return PaymentOut(
        reference=result.reference,
        status=result.status,
        amount=result.amount,
        receiver_upi_id=body.receiver_upi_id,
        receiver_name=receiver_name,
        risk_score=analysis.risk_score,
        risk_level=analysis.risk_level,
        recommended_action=analysis.recommended_action,
        detected_threats=analysis.detected_threats,
        reasons=analysis.reasons,
        created_at=time.time(),
        balance_after=result.balance_after,
    )


@router.get("/payments", response_model=list[TransactionOut])
def history(q: str = "", user: dict = Depends(current_user)) -> list[TransactionOut]:
    return [TransactionOut(**t) for t in store.list_transactions(user["id"], q)]


@router.get("/payments/{reference}", response_model=TransactionOut)
def payment_detail(reference: str, user: dict = Depends(current_user)) -> TransactionOut:
    try:
        return TransactionOut(**store.get_transaction(user["id"], reference))
    except store.NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/contacts/search", response_model=list[ContactOut])
def search_contacts(q: str = "", user: dict = Depends(current_user)) -> list[ContactOut]:
    """Local-only search over saved contacts. Never queries any external
    telecom/bank directory — only records this user explicitly saved."""
    return [ContactOut(**c, source="saved_contact") for c in store.list_contacts(user["id"], q)]

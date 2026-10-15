"""Pydantic request/response models for the simulated UPI wallet API.

Every response that reports money or a risk verdict carries an explicit
``simulated`` / ``disclaimer`` marker so the UI can never imply real funds,
real balances, or genuine threat intelligence.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

USERNAME_PATTERN = r"^[a-z0-9][a-z0-9._-]{2,31}$"
UPI_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]{1,48}@[A-Za-z0-9][A-Za-z0-9.-]{1,24}$"

SIMULATED_MONEY_NOTE = (
    "Simulated balance only. This is a demo wallet, not a real bank or UPI account; "
    "no real money moves."
)


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------


class RegisterRequest(StrictModel):
    username: str = Field(min_length=3, max_length=32, pattern=USERNAME_PATTERN)
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=64)
    phone: str | None = Field(default=None, max_length=16)

    @field_validator("phone")
    @classmethod
    def _phone_digits(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        digits = "".join(ch for ch in v if ch.isdigit() or ch == "+")
        if not digits or len(digits) < 10:
            raise ValueError("Enter a valid phone number.")
        return digits

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        if v.isalpha() or v.isdigit():
            raise ValueError("Password must mix letters and numbers.")
        return v


class LoginRequest(StrictModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    username: str
    display_name: str
    phone: str | None = None


class AuthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str
    user: UserOut
    simulated: Literal[True] = True


# --------------------------------------------------------------------------
# Wallet
# --------------------------------------------------------------------------


class WalletOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    balance: int = Field(description="Balance in paise (integer).")
    currency: Literal["INR"] = "INR"
    simulated: Literal[True] = True
    note: str = SIMULATED_MONEY_NOTE


# --------------------------------------------------------------------------
# Contacts
# --------------------------------------------------------------------------


class ContactIn(StrictModel):
    name: str = Field(min_length=1, max_length=64)
    upi_id: str = Field(min_length=5, max_length=80, pattern=UPI_ID_PATTERN)
    phone: str | None = Field(default=None, max_length=16)
    verified: bool = False

    @field_validator("phone")
    @classmethod
    def _phone_digits(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        digits = "".join(ch for ch in v if ch.isdigit() or ch == "+")
        if digits and len(digits) < 10:
            raise ValueError("Enter a valid phone number.")
        return digits or None


class ContactOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    upi_id: str
    phone: str | None = None
    verified: bool = False
    source: str = "saved_contact"
    created_at: float | None = None


# --------------------------------------------------------------------------
# Payments
# --------------------------------------------------------------------------


class PaymentRequest(StrictModel):
    receiver_upi_id: str = Field(min_length=5, max_length=80, pattern=UPI_ID_PATTERN)
    receiver_name: str | None = Field(default=None, max_length=64)
    amount: int = Field(gt=0, le=100_000_000, description="Amount in paise.")
    note: str | None = Field(default=None, max_length=140)
    risk_payload: str | None = Field(default=None, max_length=4096)
    idempotency_key: str | None = Field(default=None, max_length=64)
    confirm_risk: bool = False


class PaymentOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reference: str
    status: str
    amount: int
    receiver_upi_id: str
    receiver_name: str | None = None
    risk_score: int | None = None
    risk_level: str | None = None
    recommended_action: str | None = None
    detected_threats: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)
    created_at: float | None = None
    balance_after: int | None = None
    simulated: Literal[True] = True


class TransactionOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    reference: str
    receiver_upi_id: str
    receiver_name: str | None = None
    amount: int
    note: str | None = None
    status: str
    risk_score: int | None = None
    risk_level: str | None = None
    recommended_action: str | None = None
    analysis: dict | None = None
    created_at: float
    simulated: Literal[True] = True

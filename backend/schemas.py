from typing import Literal

from pydantic import BaseModel, Field


RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
RecommendedAction = Literal["ALLOW", "WARN_AND_VERIFY", "BLOCK"]
InputType = Literal["qr", "url", "upi"]


class UrlAnalysisRequest(BaseModel):
    url: str = Field(min_length=1, max_length=4096)


class UpiAnalysisRequest(BaseModel):
    upi_id: str = Field(min_length=1, max_length=256)


class QrAnalysisRequest(BaseModel):
    payload: str = Field(min_length=1, max_length=4096)


class RecipientInfo(BaseModel):
    upi_id: str | None = None
    payee_name: str | None = None
    amount: float | None = None
    transaction_ref: str | None = None
    note: str | None = None
    domain: str | None = None


class AnalysisResponse(BaseModel):
    input_type: InputType
    risk_score: int = Field(ge=0, le=100)
    risk_level: RiskLevel
    detected_threats: list[str]
    reasons: list[str]
    recipient_info: RecipientInfo
    recommended_action: RecommendedAction
    is_valid: bool
    analyzed_value: str
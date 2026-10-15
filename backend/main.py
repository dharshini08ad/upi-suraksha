import logging
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.datastructures import UploadFile

from backend.engine import RiskAnalyzer
from backend.qr_decoder import decode_qr_image
from backend.schemas import AnalysisResponse, QrAnalysisRequest, UpiAnalysisRequest, UrlAnalysisRequest
from backend.simulator import router as simulator_router


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("upi_fraud_api")
analyzer = RiskAnalyzer()

try:
    from backend import db as _db

    _db.init_db()
    logger.info("Simulator database initialised (migrations applied).")
except Exception:  # pragma: no cover - surfaced at startup
    logger.exception("Failed to initialise simulator database")
    raise


app = FastAPI(
    title="UPI Phishing and Fraud Detection API",
    version="1.0.0",
    description="Local, rules-based risk analysis. It does not initiate or process payments.",
)
environment = os.getenv("ENVIRONMENT", "development").casefold()
default_origins = "" if environment == "production" else "http://localhost:5173,http://127.0.0.1:5173"
dev_origin_regex = (
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    if environment != "production"
    else None
)
origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ORIGINS", default_origins).split(",")
    if origin.strip()
]
if "*" in origins:
    raise RuntimeError("CORS_ORIGINS must list explicit frontend origins; wildcard CORS is disabled.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=dev_origin_regex,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(simulator_router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "analysis_mode": "local_rules"}


@app.post("/api/analyze/upi", response_model=AnalysisResponse)
async def analyze_upi(request: UpiAnalysisRequest) -> AnalysisResponse:
    logger.info("Analyzing UPI ID input")
    return analyzer.analyze_upi(request.upi_id)


@app.post("/api/analyze/url", response_model=AnalysisResponse)
async def analyze_url(request: UrlAnalysisRequest) -> AnalysisResponse:
    logger.info("Analyzing payment URL input")
    return analyzer.analyze_url(request.url)


@app.post("/api/analyze/qr", response_model=AnalysisResponse)
async def analyze_qr(request: Request) -> AnalysisResponse:
    try:
        content_type = request.headers.get("content-type", "").casefold()
        if content_type.startswith("application/json"):
            try:
                body = QrAnalysisRequest.model_validate(await request.json())
            except Exception as exc:
                raise HTTPException(status_code=422, detail="JSON body must include a non-empty 'payload' string.") from exc
            payload = body.payload.strip()
            if not payload:
                raise HTTPException(status_code=422, detail="QR payload cannot be empty.")
            logger.info("Analyzing decoded QR payload")
        elif content_type.startswith("multipart/form-data"):
            form = await request.form()
            image = form.get("image")
            if not isinstance(image, UploadFile):
                raise HTTPException(status_code=422, detail="Submit the QR image in a multipart 'image' field.")
            logger.info("Analyzing uploaded QR image (%s)", image.content_type or "unknown content type")
            payload = await decode_qr_image(image)
        else:
            raise HTTPException(status_code=415, detail="Submit JSON with 'payload' or a multipart QR image.")

        result = analyzer.analyze_qr_payload(payload)
        logger.info("QR analysis completed: type=%s level=%s score=%d", result.input_type, result.risk_level, result.risk_score)
        return result
    except HTTPException as exc:
        logger.warning("QR analysis rejected: %s", exc.detail)
        raise
    except Exception:
        logger.exception("Unexpected QR analysis failure")
        raise HTTPException(status_code=500, detail="QR analysis failed unexpectedly.") from None
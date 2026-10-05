from fastapi.testclient import TestClient
import cv2

from backend.engine import AnalysisSignals, _risk_result
from backend.main import app
from backend.schemas import RecipientInfo


client = TestClient(app)


def test_health_reports_local_mode() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "analysis_mode": "local_rules"}


def test_upi_analysis_has_expected_response_and_levels() -> None:
    response = client.post("/api/analyze/upi", json={"upi_id": "rbi-refund@okbank"})
    result = response.json()
    assert response.status_code == 200
    assert result["risk_level"] == "HIGH"
    assert result["recommended_action"] == "BLOCK"
    assert 0 <= result["risk_score"] <= 100
    assert "possible_impersonation" in result["detected_threats"]
    assert result["recipient_info"]["upi_id"] == "rbi-refund@okbank"


def test_url_analysis_flags_http_shortener_and_redirect() -> None:
    response = client.post(
        "/api/analyze/url",
        json={"url": "http://bit.ly/pay?redirect=https%3A%2F%2Fbad.example%2Fkyc"},
    )
    result = response.json()
    assert response.status_code == 200
    assert result["risk_level"] == "HIGH"
    assert result["recommended_action"] == "BLOCK"
    assert {"insecure_transport", "url_shortener", "external_redirect"}.issubset(result["detected_threats"])
    assert result["recipient_info"]["domain"] == "bit.ly"


def test_payment_url_extracts_embedded_upi_id() -> None:
    result = client.post(
        "/api/analyze/url",
        json={"url": "https://merchant.example/pay?pa=shop%40okaxis&pn=Corner+Shop&am=125.50&tr=INV-42"},
    ).json()
    assert result["recipient_info"]["upi_id"] == "shop@okaxis"
    assert result["recipient_info"]["domain"] == "merchant.example"


def test_qr_payload_parser_extracts_payment_fields() -> None:
    from backend.main import analyzer

    result = analyzer.analyze_qr_payload("upi://pay?pa=shop%40okaxis&pn=Corner+Shop&am=125.50&tr=INV-42")
    assert result.input_type == "qr"
    assert result.recipient_info.model_dump() == {
        "upi_id": "shop@okaxis",
        "payee_name": "Corner Shop",
        "amount": 125.5,
        "transaction_ref": "INV-42",
        "note": None,
        "domain": None,
    }


def test_qr_endpoint_accepts_decoded_json_payload() -> None:
    response = client.post(
        "/api/analyze/qr",
        json={"payload": "upi://pay?pa=shop%40okaxis&pn=Corner+Shop&am=125.50"},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["input_type"] == "qr"
    assert result["recipient_info"]["upi_id"] == "shop@okaxis"
    assert result["recipient_info"]["payee_name"] == "Corner Shop"
    assert result["recipient_info"]["amount"] == 125.5


def test_qr_payload_can_be_a_bare_upi_id() -> None:
    result = client.post("/api/analyze/qr", json={"payload": "merchant@okaxis"}).json()
    assert result["input_type"] == "qr"
    assert result["recipient_info"]["upi_id"] == "merchant@okaxis"


def test_qr_endpoint_rejects_empty_decoded_payload() -> None:
    response = client.post("/api/analyze/qr", json={"payload": "   "})
    assert response.status_code == 422


def test_invalid_upi_id_requires_verification() -> None:
    result = client.post("/api/analyze/upi", json={"upi_id": "not-a-vpa"}).json()
    assert result["is_valid"] is False
    assert result["risk_level"] == "MEDIUM"
    assert result["recommended_action"] == "WARN_AND_VERIFY"


def test_qr_merchant_and_transaction_context_affect_risk() -> None:
    from backend.main import analyzer

    result = analyzer.analyze_qr_payload(
        "upi://pay?pa=store%40okaxis&pn=NPCI+Refund&tn=Share+your+OTP+to+claim+refund"
    )
    assert result.risk_score >= 71
    assert result.risk_level == "HIGH"
    assert "suspicious_merchant_name" in result.detected_threats
    assert "credential_request_in_qr" in result.detected_threats
    assert result.recipient_info.transaction_ref is None
    assert result.recipient_info.note == "Share your OTP to claim refund"


def test_qr_rejects_non_finite_amount() -> None:
    from backend.main import analyzer

    result = analyzer.analyze_qr_payload("upi://pay?pa=shop%40okaxis&am=inf")
    assert result.is_valid is False
    assert result.risk_level == "MEDIUM"
    assert result.recommended_action == "WARN_AND_VERIFY"


def test_risk_bands_and_actions_use_requested_boundaries() -> None:
    expected = {
        0: ("LOW", "ALLOW"),
        30: ("LOW", "ALLOW"),
        31: ("MEDIUM", "WARN_AND_VERIFY"),
        70: ("MEDIUM", "WARN_AND_VERIFY"),
        71: ("HIGH", "BLOCK"),
        100: ("HIGH", "BLOCK"),
    }
    for score, (level, action) in expected.items():
        result = _risk_result("upi", "merchant@provider", AnalysisSignals(points=score), RecipientInfo(), True)
        assert (result.risk_level, result.recommended_action) == (level, action)


def test_qr_image_upload_decodes_and_extracts_payment_fields() -> None:
    payload = "upi://pay?pa=shop%40okaxis&pn=Corner+Shop&am=125.50&tr=INV-42"
    qr_image = cv2.QRCodeEncoder_create().encode(payload)
    success, encoded_image = cv2.imencode(".png", qr_image)
    assert success

    response = client.post(
        "/api/analyze/qr",
        files={"image": ("payment.png", encoded_image.tobytes(), "image/png")},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["input_type"] == "qr"
    assert result["recipient_info"]["upi_id"] == "shop@okaxis"
    assert result["recipient_info"]["payee_name"] == "Corner Shop"
    assert result["recipient_info"]["amount"] == 125.5
    assert result["recipient_info"]["transaction_ref"] == "INV-42"


def test_invalid_url_is_a_structured_high_risk_result() -> None:
    result = client.post("/api/analyze/url", json={"url": "not a url / ???"}).json()
    assert result["is_valid"] is False
    assert result["risk_level"] == "MEDIUM"
    assert result["recommended_action"] == "WARN_AND_VERIFY"
    assert result["detected_threats"] == ["invalid_url"]


def test_url_request_validates_empty_values() -> None:
    assert client.post("/api/analyze/url", json={"url": ""}).status_code == 422
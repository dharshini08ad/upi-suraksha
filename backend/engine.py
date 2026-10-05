import ipaddress
import math
import re
from dataclasses import dataclass, field
from urllib.parse import parse_qs, unquote, urlsplit

from backend.interfaces import ThreatIntelligenceProvider
from backend.schemas import AnalysisResponse, InputType, RecipientInfo


UPI_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,48}@[A-Za-z0-9][A-Za-z0-9.-]{1,24}$")
UPI_ID_SEARCH = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{1,48}@[A-Za-z0-9][A-Za-z0-9.-]{1,24}")
SHORTENER_DOMAINS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "cutt.ly", "rb.gy", "rebrand.ly",
}
SUSPICIOUS_TERMS = {
    "verify", "verification", "kyc", "refund", "reward", "prize", "cashback", "lottery", "claim",
    "urgent", "suspend", "blocked", "update-account", "free-gift",
}
IMPERSONATION_TERMS = {
    "rbi", "npci", "bank", "support", "government", "police", "refund", "kyc", "security",
}
REDIRECT_KEYS = {"redirect", "redirect_url", "url", "next", "continue", "return", "returnurl", "target", "dest"}
SENSITIVE_TERMS = {"otp", "pin", "mpin", "cvv", "password", "passcode"}
MERCHANT_CLAIM_TERMS = {"rbi", "npci", "uidai", "government", "police", "official", "support", "kyc", "refund"}
SUSPICIOUS_NOTE_TERMS = {"refund", "reward", "prize", "kyc", "verify", "urgent", "blocked", "suspended"}


@dataclass
class AnalysisSignals:
    threats: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
    points: int = 0

    def add(self, points: int, threat: str, reason: str) -> None:
        if threat not in self.threats:
            self.threats.append(threat)
            self.reasons.append(reason)
            self.points += points


def _host_is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host.strip("[]"))
        return True
    except ValueError:
        return False


def _normalize_url(raw: str) -> str:
    candidate = raw.strip()
    if not re.match(r"^[A-Za-z][A-Za-z0-9+.-]*://", candidate):
        candidate = "https://" + candidate
    return candidate


def _risk_result(input_type: InputType, value: str, signals: AnalysisSignals, recipient: RecipientInfo, valid: bool) -> AnalysisResponse:
    score = min(100, max(0, signals.points))
    level = "LOW" if score <= 30 else "MEDIUM" if score <= 70 else "HIGH"
    action = {"LOW": "ALLOW", "MEDIUM": "WARN_AND_VERIFY", "HIGH": "BLOCK"}[level]
    return AnalysisResponse(
        input_type=input_type,
        risk_score=score,
        risk_level=level,
        detected_threats=signals.threats,
        reasons=signals.reasons or ["No high-risk indicators were found by local checks; this is not a guarantee of safety."],
        recipient_info=recipient,
        recommended_action=action,
        is_valid=valid,
        analyzed_value=value,
    )


class RiskAnalyzer:
    """Deterministic local rules; external reputation/model providers can be injected later."""

    def __init__(self, threat_intelligence: ThreatIntelligenceProvider | None = None) -> None:
        self.threat_intelligence = threat_intelligence

    def analyze_upi(self, upi_id: str) -> AnalysisResponse:
        value = upi_id.strip()
        signals = AnalysisSignals()
        valid = bool(UPI_ID_PATTERN.fullmatch(value))
        if not valid:
            signals.add(31, "invalid_upi_id", "The UPI ID does not match the expected payee@provider format.")
        else:
            handle, _ = value.rsplit("@", 1)
            lowered = handle.casefold()
            if handle.isdigit():
                signals.add(24, "numeric_payee", "The payee handle contains only digits, which can be a throwaway-account pattern.")
            if len(handle) > 32:
                signals.add(10, "unusually_long_payee", "The payee handle is unusually long and should be verified independently.")
            suspicious = sorted(term for term in IMPERSONATION_TERMS if term in lowered)
            if suspicious:
                weight = min(72, 36 * len(suspicious))
                signals.add(weight, "possible_impersonation", f"The payee handle uses official-sounding or sensitive terms: {', '.join(suspicious)}.")
            if self.threat_intelligence:
                for threat in self.threat_intelligence.check_upi_id(value):
                    signals.add(35, "threat_intelligence_match", threat)

        if not signals.threats:
            signals.reasons.append("The UPI ID format is valid; ownership and account status are not verified by local checks.")
        recipient = RecipientInfo(upi_id=value if valid else None)
        return _risk_result("upi", value, signals, recipient, valid)

    def analyze_url(self, raw_url: str, input_type: InputType = "url", *, payee_name: str | None = None,
                    amount: float | None = None, transaction_ref: str | None = None) -> AnalysisResponse:
        value = raw_url.strip()
        signals = AnalysisSignals()
        recipient = RecipientInfo(payee_name=payee_name, amount=amount, transaction_ref=transaction_ref)
        valid = True

        try:
            normalized = _normalize_url(value)
            parts = urlsplit(normalized)
            host = (parts.hostname or "").casefold().rstrip(".")
            _ = parts.port
            if parts.scheme not in {"http", "https"} or not host or any(char.isspace() for char in host):
                raise ValueError("invalid web URL")
        except ValueError:
            valid = False
            signals.add(32, "invalid_url", "The value is not a valid HTTP or HTTPS URL with a hostname.")
            return _risk_result(input_type, value, signals, recipient, valid)

        recipient.domain = host
        if parts.scheme.casefold() != "https":
            signals.add(15, "insecure_transport", "The URL uses HTTP instead of encrypted HTTPS.")
        if _host_is_ip(host):
            signals.add(28, "ip_address_host", "The link uses a raw IP address instead of a verifiable domain name.")
        if "xn--" in host or not host.isascii():
            signals.add(24, "internationalized_domain", "The domain contains punycode or non-ASCII characters that can disguise lookalike names.")

        if host in SHORTENER_DOMAINS or any(host.endswith("." + shortener) for shortener in SHORTENER_DOMAINS):
            signals.add(20, "url_shortener", "A URL shortener hides the link's final destination; verify it before proceeding.")

        full_text = unquote(value).casefold()
        suspicious = sorted(term for term in SUSPICIOUS_TERMS if term in full_text)
        if suspicious:
            signals.add(14, "suspicious_url_language", f"The URL contains common social-engineering terms: {', '.join(suspicious)}.")
        if any(_contains_term(full_text, term) for term in SENSITIVE_TERMS):
            signals.add(24, "credential_harvesting_language", "The URL mentions credentials such as an OTP, PIN, or password.")

        query = parse_qs(parts.query, keep_blank_values=True)
        for key, values in query.items():
            if key.casefold() not in REDIRECT_KEYS:
                continue
            for target in values:
                decoded_target = unquote(target)
                if decoded_target.startswith(("http://", "https://")):
                    target_host = (urlsplit(decoded_target).hostname or "").casefold()
                    if target_host and target_host != host:
                        signals.add(24, "external_redirect", "The URL includes a redirect parameter that can send users to a different domain.")
                        break
                elif target:
                    signals.add(8, "redirect_parameter", "The URL contains a redirect parameter whose destination is not directly visible.")
                    break

        if self.threat_intelligence:
            for threat in self.threat_intelligence.check_domain(host):
                signals.add(40, "threat_intelligence_match", threat)

        upi_id = self._extract_upi(value)
        if upi_id:
            recipient.upi_id = upi_id
        if not signals.threats:
            signals.reasons.append("No known malicious patterns were found locally; domain ownership and reputation are not verified.")
        return _risk_result(input_type, value, signals, recipient, valid)

    def analyze_qr_payload(self, payload: str) -> AnalysisResponse:
        value = payload.strip()
        if UPI_ID_PATTERN.fullmatch(value):
            result = self.analyze_upi(value)
            result.input_type = "qr"
            result.analyzed_value = value
            return result

        parts = urlsplit(value)
        if parts.scheme.casefold() == "upi" and parts.netloc.casefold() == "pay":
            params = parse_qs(parts.query, keep_blank_values=True)
            payee = _first(params, "pa")
            payee_name = _first(params, "pn")
            note = _first(params, "tn")
            raw_amount = _first(params, "am")
            recipient = RecipientInfo(
                upi_id=payee,
                payee_name=payee_name,
                amount=_amount(raw_amount),
                transaction_ref=_first(params, "tr"),
                note=note,
            )
            result = self.analyze_upi(payee or "")
            result.input_type = "qr"
            result.analyzed_value = value
            result.recipient_info = recipient
            signals = AnalysisSignals(result.detected_threats, result.reasons, result.risk_score)
            if not payee:
                signals.add(31, "missing_qr_payee", "The UPI payment QR does not contain a payee address.")
            if payee_name:
                claims = sorted(term for term in MERCHANT_CLAIM_TERMS if _contains_term(payee_name.casefold(), term))
                if claims:
                    signals.add(24, "suspicious_merchant_name", f"The merchant name uses official-sounding or high-pressure terms: {', '.join(claims)}.")
            if note:
                note_text = note.casefold()
                if any(_contains_term(note_text, term) for term in SENSITIVE_TERMS):
                    signals.add(45, "credential_request_in_qr", "The QR note refers to an OTP, PIN, or password; never share payment credentials.")
                note_claims = sorted(term for term in SUSPICIOUS_NOTE_TERMS if _contains_term(note_text, term))
                if note_claims:
                    signals.add(18, "suspicious_transaction_note", f"The QR note contains suspicious payment instructions: {', '.join(note_claims)}.")
            amount = recipient.amount
            if raw_amount is not None and amount is None:
                signals.add(31, "invalid_amount", "The QR amount is not a valid finite non-negative number.")
            if amount is not None and amount <= 1:
                signals.add(12, "nominal_amount", "The QR requests a nominal amount; confirm this is the intended transaction.")
            if not signals.threats:
                signals.reasons.append("The UPI QR fields are readable; payee identity is not independently verified.")
            valid = bool(payee and UPI_ID_PATTERN.fullmatch(payee) and (raw_amount is None or amount is not None))
            return _risk_result("qr", value, signals, recipient, valid)

        if value.startswith(("https://", "http://")):
            return self.analyze_url(value, "qr")
        signals = AnalysisSignals()
        signals.add(31, "unsupported_qr_content", "The QR does not contain a supported UPI payment URI or web URL.")
        return _risk_result("qr", value, signals, RecipientInfo(), False)

    @staticmethod
    def _extract_upi(value: str) -> str | None:
        decoded = unquote(value)
        match = UPI_ID_SEARCH.search(decoded)
        return match.group(0) if match else None


def _first(params: dict[str, list[str]], key: str) -> str | None:
    values = params.get(key)
    return values[0].strip() if values and values[0].strip() else None


def _amount(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        amount = float(value)
        return amount if amount >= 0 and math.isfinite(amount) else None
    except ValueError:
        return None


def _contains_term(text: str, term: str) -> bool:
    return re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", text) is not None
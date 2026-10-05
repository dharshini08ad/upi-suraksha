from collections.abc import Sequence
from typing import Protocol


class ThreatIntelligenceProvider(Protocol):
    """Optional external reputation lookups; implementations must not be required locally."""

    def check_domain(self, domain: str) -> Sequence[str]: ...

    def check_upi_id(self, upi_id: str) -> Sequence[str]: ...


class AnalysisRepository(Protocol):
    """Persistence boundary for a future database-backed analysis history."""

    def save(self, analysis: dict[str, object]) -> None: ...
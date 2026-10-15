"""Security primitives for the UPI Suraksha simulated wallet.

This module is deliberately dependency-free (standard library only) so the
security guarantees are easy to audit:

* Passwords are stored as PBKDF2-HMAC-SHA256 with a per-user random salt and a
  high iteration count. Plaintext passwords are never persisted or logged.
* Session tokens are high-entropy random strings; only their SHA-256 hash is
  stored server-side, so a database leak cannot be replayed as a live session.
* A small in-memory sliding-window rate limiter protects auth and payment
  endpoints from brute force and replay. It is per-process, which is the
  correct trade-off for a single-process simulation server.

None of this moves real money — the wallet is a simulation — but the security
patterns (hashing, hashed bearer sessions, rate limiting) are the real ones.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import threading
import time
from collections import deque

# PBKDF2 parameters. 200k iterations of SHA-256 is a reasonable balance between
# security and responsiveness for an interactive demo login.
_PBKDF2_ALGORITHM = "sha256"
_PBKDF2_ITERATIONS = 200_000
_SALT_BYTES = 16


def hash_password(password: str, *, salt: bytes | None = None) -> tuple[str, str]:
    """Return (hex_hash, hex_salt) for the given password.

    A fresh random salt is generated when one is not supplied.
    """
    if salt is None:
        salt = secrets.token_bytes(_SALT_BYTES)
    derived = hashlib.pbkdf2_hmac(
        _PBKDF2_ALGORITHM,
        password.encode("utf-8"),
        salt,
        _PBKDF2_ITERATIONS,
    )
    return derived.hex(), salt.hex()


def verify_password(password: str, expected_hash: str, salt_hex: str) -> bool:
    """Constant-time check of a password against a stored hash and salt."""
    try:
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    candidate, _ = hash_password(password, salt=salt)
    return hmac.compare_digest(candidate, expected_hash)


def new_token() -> str:
    """Generate a URL-safe, high-entropy bearer token (256 bits)."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Hash a session token for storage/lookup (never store raw tokens)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class RateLimiter:
    """Thread-safe sliding-window rate limiter keyed by an arbitrary string.

    ``allow(key)`` returns True when the caller is within the limit and records
    the event, or False when the caller has exceeded ``max_events`` within the
    trailing ``window_seconds``.
    """

    def __init__(self, max_events: int, window_seconds: float) -> None:
        self._max_events = max_events
        self._window = window_seconds
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            bucket = self._events.setdefault(key, deque())
            while bucket and now - bucket[0] >= self._window:
                bucket.popleft()
            if len(bucket) >= self._max_events:
                return False
            bucket.append(now)
            return True

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._events.clear()
            else:
                self._events.pop(key, None)

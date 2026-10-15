"""Persistent SQLite storage for the UPI Suraksha simulated wallet.

Design goals:
* Money is stored as **integer paise** so no floating point drift occurs.
* Every query is **parameterised**; no string interpolation of user input.
* Balance changes happen inside a ``BEGIN IMMEDIATE`` transaction with the
  balance re-checked inside the transaction, so concurrent spends cannot send
  the balance negative.
* Schema changes run through an ordered, idempotent **migration** list tracked
  in a ``schema_migrations`` table.

This is a *simulation* database. It never talks to a bank, UPI switch, or any
real payment network.
"""

from __future__ import annotations

import os
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from typing import Iterator

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "simulator.db")

_local = threading.local()


def _db_path() -> str:
    return os.getenv("UPI_SIM_DB", DEFAULT_DB_PATH)


def get_conn() -> sqlite3.Connection:
    """Return a thread-local connection with safe pragmas applied."""
    conn = getattr(_local, "conn", None)
    path = _db_path()
    if conn is None or getattr(_local, "path", None) != path:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass
        conn = sqlite3.connect(path, timeout=15, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        _local.conn = conn
        _local.path = path
    return conn


def close_conn() -> None:
    conn = getattr(_local, "conn", None)
    if conn is not None:
        try:
            conn.close()
        except Exception:
            pass
        _local.conn = None
        _local.path = None


@contextmanager
def write_txn() -> Iterator[sqlite3.Connection]:
    """Yield a connection wrapped in an IMMEDIATE write transaction."""
    conn = get_conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise



# --------------------------------------------------------------------------
# Migrations
# --------------------------------------------------------------------------

MIGRATIONS: list[tuple[str, list[str]]] = [
    (
        "0001_core_tables",
        [
            """
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                username      TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                display_name  TEXT NOT NULL,
                phone         TEXT,
                created_at    REAL NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at REAL NOT NULL,
                expires_at REAL NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS wallets (
                user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                balance     INTEGER NOT NULL,
                updated_at  REAL NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS contacts (
                id         TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name       TEXT NOT NULL,
                upi_id     TEXT NOT NULL,
                phone      TEXT,
                verified   INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL,
                UNIQUE (user_id, upi_id)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS transactions (
                id          TEXT PRIMARY KEY,
                reference   TEXT NOT NULL UNIQUE,
                sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                receiver_upi_id TEXT NOT NULL,
                receiver_name   TEXT,
                amount      INTEGER NOT NULL,
                note        TEXT,
                status      TEXT NOT NULL,
                risk_score  INTEGER,
                risk_level  TEXT,
                recommended_action TEXT,
                analysis_json TEXT,
                idempotency_key TEXT,
                created_at  REAL NOT NULL
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_txn_sender ON transactions(sender_id, created_at DESC)",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_idem ON transactions(sender_id, idempotency_key) WHERE idempotency_key IS NOT NULL",
            """
            CREATE TABLE IF NOT EXISTS audit_log (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                ts      REAL NOT NULL,
                user_id TEXT,
                event   TEXT NOT NULL,
                detail  TEXT
            )
            """,
        ],
    ),
]


def run_migrations(conn: sqlite3.Connection | None = None) -> None:
    """Apply any pending migrations. Safe to call repeatedly."""
    conn = conn or get_conn()
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at REAL NOT NULL)"
    )
    applied = {row["name"] for row in conn.execute("SELECT name FROM schema_migrations")}
    for name, statements in MIGRATIONS:
        if name in applied:
            continue
        for stmt in statements:
            conn.execute(stmt)
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)", (name, time.time())
        )
        conn.commit()


def init_db() -> None:
    """Initialise the database (open connection + run migrations)."""
    run_migrations(get_conn())


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def new_id(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:12].upper()}"


def audit(user_id: str | None, event: str, detail: str | None = None) -> None:
    """Append an audit-log entry. Best-effort; never raises to the caller."""
    try:
        conn = get_conn()
        conn.execute(
            "INSERT INTO audit_log (ts, user_id, event, detail) VALUES (?, ?, ?, ?)",
            (time.time(), user_id, event, detail),
        )
        conn.commit()
    except Exception:
        pass


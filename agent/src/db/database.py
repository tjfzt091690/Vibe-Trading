"""PostgreSQL database backend with automatic fallback.

Provides fast indexed queries for run metadata, session data, and goal
state — replacing the expensive filesystem scans in ``api_server.py``.

The schema is created automatically on first connection. When PostgreSQL
is unavailable, all methods return ``None`` / empty results so the caller
can fall back to file-based logic.
"""

from __future__ import annotations

import csv
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://vibe:vibe@localhost:5432/vibe_trading",
)

_SCHEMA_SQL = """\
CREATE TABLE IF NOT EXISTS runs (
    run_id        TEXT PRIMARY KEY,
    status        TEXT NOT NULL DEFAULT 'unknown',
    prompt        TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_return  DOUBLE PRECISION,
    sharpe        DOUBLE PRECISION,
    max_drawdown  DOUBLE PRECISION,
    annual_return DOUBLE PRECISION,
    win_rate      DOUBLE PRECISION,
    trade_count   INTEGER,
    final_value   DOUBLE PRECISION,
    codes         TEXT[],
    start_date    TEXT,
    end_date      TEXT,
    source        TEXT,
    interval      TEXT DEFAULT '1D',
    run_directory TEXT,
    elapsed_seconds DOUBLE PRECISION,
    metrics_json  JSONB,
    run_context_json JSONB
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id    TEXT PRIMARY KEY,
    title         TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_attempt_id TEXT,
    config_json   JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS goals (
    goal_id       TEXT PRIMARY KEY,
    session_id    TEXT REFERENCES sessions(session_id) ON DELETE CASCADE,
    objective     TEXT NOT NULL,
    ui_summary    TEXT DEFAULT '',
    protocol      TEXT DEFAULT 'thesis_review',
    risk_tier     TEXT DEFAULT 'research_general',
    status        TEXT DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    goal_json     JSONB
);

CREATE INDEX IF NOT EXISTS idx_runs_status ON runs (status);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);
CREATE INDEX IF NOT EXISTS idx_goals_session ON goals (session_id);
"""


class DatabaseBackend:
    """PostgreSQL backend with graceful degradation."""

    def __init__(self) -> None:
        self._conn: Any = None
        self._available: bool = False
        self._init_db()

    def _init_db(self) -> None:
        try:
            import psycopg2

            self._conn = psycopg2.connect(DATABASE_URL)
            self._conn.autocommit = True
            with self._conn.cursor() as cur:
                cur.execute(_SCHEMA_SQL)
            self._available = True
            logger.info("PostgreSQL connected: %s", DATABASE_URL.split("@")[-1])
        except Exception as exc:
            self._conn = None
            self._available = False
            logger.warning(
                "PostgreSQL unavailable (%s), falling back to file-based storage",
                exc,
            )

    @property
    def is_available(self) -> bool:
        return self._available

    def upsert_run(self, run_id: str, **fields: Any) -> None:
        if not self._available:
            return
        try:
            import psycopg2.extras

            cols = ["run_id"]
            vals = [run_id]
            updates = []
            for k, v in fields.items():
                if v is None:
                    continue
                cols.append(k)
                vals.append(v)
                if k != "run_id":
                    updates.append(f"{k} = EXCLUDED.{k}")

            if not updates:
                return

            placeholders = ", ".join(["%s"] * len(cols))
            col_str = ", ".join(cols)
            sql = f"INSERT INTO runs ({col_str}) VALUES ({placeholders}) ON CONFLICT (run_id) DO UPDATE SET {', '.join(updates)}, updated_at = now()"

            with self._conn.cursor() as cur:
                cur.execute(sql, vals)
        except Exception as exc:
            logger.debug("upsert_run failed for %s: %s", run_id, exc)
            self._reconnect()

    def get_run(self, run_id: str) -> Optional[dict[str, Any]]:
        if not self._available:
            return None
        try:
            with self._conn.cursor() as cur:
                cur.execute("SELECT * FROM runs WHERE run_id = %s", (run_id,))
                row = cur.fetchone()
                if row is None:
                    return None
                cols = [desc[0] for desc in cur.description]
                result = dict(zip(cols, row))
                for json_col in ("metrics_json", "run_context_json"):
                    if json_col in result and isinstance(result[json_col], str):
                        try:
                            result[json_col] = json.loads(result[json_col])
                        except (json.JSONDecodeError, TypeError):
                            pass
                return result
        except Exception as exc:
            logger.debug("get_run failed for %s: %s", run_id, exc)
            self._reconnect()
            return None

    def list_runs(self, limit: int = 20, status_filter: Optional[str] = None) -> list[dict[str, Any]]:
        if not self._available:
            return []
        try:
            sql = "SELECT run_id, status, prompt, created_at, total_return, sharpe, codes, start_date, end_date FROM runs"
            params: list[Any] = []
            if status_filter:
                sql += " WHERE status = %s"
                params.append(status_filter)
            sql += " ORDER BY created_at DESC LIMIT %s"
            params.append(limit)

            with self._conn.cursor() as cur:
                cur.execute(sql, params)
                cols = [desc[0] for desc in cur.description]
                return [dict(zip(cols, row)) for row in cur.fetchall()]
        except Exception as exc:
            logger.debug("list_runs failed: %s", exc)
            self._reconnect()
            return []

    def upsert_session(self, session_id: str, **fields: Any) -> None:
        if not self._available:
            return
        try:
            cols = ["session_id"]
            vals = [session_id]
            updates = []
            for k, v in fields.items():
                if v is None:
                    continue
                cols.append(k)
                vals.append(v)
                if k != "session_id":
                    updates.append(f"{k} = EXCLUDED.{k}")

            if not updates:
                return

            placeholders = ", ".join(["%s"] * len(cols))
            col_str = ", ".join(cols)
            sql = f"INSERT INTO sessions ({col_str}) VALUES ({placeholders}) ON CONFLICT (session_id) DO UPDATE SET {', '.join(updates)}, updated_at = now()"

            with self._conn.cursor() as cur:
                cur.execute(sql, vals)
        except Exception as exc:
            logger.debug("upsert_session failed for %s: %s", session_id, exc)
            self._reconnect()

    def get_session(self, session_id: str) -> Optional[dict[str, Any]]:
        if not self._available:
            return None
        try:
            with self._conn.cursor() as cur:
                cur.execute("SELECT * FROM sessions WHERE session_id = %s", (session_id,))
                row = cur.fetchone()
                if row is None:
                    return None
                cols = [desc[0] for desc in cur.description]
                result = dict(zip(cols, row))
                for json_col in ("config_json",):
                    if json_col in result and isinstance(result[json_col], str):
                        try:
                            result[json_col] = json.loads(result[json_col])
                        except (json.JSONDecodeError, TypeError):
                            pass
                return result
        except Exception as exc:
            logger.debug("get_session failed for %s: %s", session_id, exc)
            self._reconnect()
            return None

    def list_sessions(self, limit: int = 50) -> list[dict[str, Any]]:
        if not self._available:
            return []
        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    "SELECT session_id, title, status, created_at, updated_at, last_attempt_id FROM sessions ORDER BY updated_at DESC LIMIT %s",
                    (limit,),
                )
                cols = [desc[0] for desc in cur.description]
                return [dict(zip(cols, row)) for row in cur.fetchall()]
        except Exception as exc:
            logger.debug("list_sessions failed: %s", exc)
            self._reconnect()
            return []

    def delete_session(self, session_id: str) -> bool:
        if not self._available:
            return False
        try:
            with self._conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE session_id = %s", (session_id,))
                return cur.rowcount > 0
        except Exception as exc:
            logger.debug("delete_session failed for %s: %s", session_id, exc)
            self._reconnect()
            return False

    def count_runs(self) -> int:
        if not self._available:
            return 0
        try:
            with self._conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM runs")
                row = cur.fetchone()
                return int(row[0]) if row else 0
        except Exception as exc:
            logger.debug("count_runs failed: %s", exc)
            self._reconnect()
            return 0

    def sync_run_from_dir(self, run_dir: Path) -> None:
        if not self._available:
            return
        run_id = run_dir.name
        try:
            fields: dict[str, Any] = {"run_directory": str(run_dir)}

            state_data = _load_json_file(run_dir / "state.json")
            if state_data:
                fields["status"] = str(state_data.get("status") or "unknown").lower()
            elif (run_dir / "artifacts" / "equity.csv").exists():
                fields["status"] = "success"
            elif (run_dir / "review_report.json").exists():
                fields["status"] = "success"
            else:
                fields["status"] = "unknown"

            req_data = _load_json_file(run_dir / "req.json")
            if req_data:
                fields["prompt"] = req_data.get("prompt")
                ctx = req_data.get("context") or {}
                codes = ctx.get("codes")
                if isinstance(codes, list):
                    fields["codes"] = codes
                elif isinstance(codes, str):
                    fields["codes"] = [c.strip() for c in codes.split(",") if c.strip()]
                if ctx.get("start_date"):
                    fields["start_date"] = str(ctx["start_date"])
                if ctx.get("end_date"):
                    fields["end_date"] = str(ctx["end_date"])
                if ctx.get("source"):
                    fields["source"] = str(ctx["source"])
                if ctx.get("interval"):
                    fields["interval"] = str(ctx["interval"])

            if not req_data or not fields.get("codes"):
                planner_data = _load_json_file(run_dir / "planner_output.json")
                if planner_data:
                    if not fields.get("prompt"):
                        fields["prompt"] = planner_data.get("user_goal") or planner_data.get("goal")
                    contract = planner_data.get("coding_contract") or {}
                    if not fields.get("codes"):
                        raw_codes = contract.get("target_scope") or contract.get("codes")
                        if isinstance(raw_codes, list):
                            fields["codes"] = raw_codes
                        elif isinstance(raw_codes, str):
                            fields["codes"] = [c.strip() for c in raw_codes.split(",") if c.strip()]
                    if not fields.get("start_date"):
                        sd = contract.get("start_date")
                        if sd:
                            fields["start_date"] = str(sd)
                    if not fields.get("end_date"):
                        ed = contract.get("end_date")
                        if ed:
                            fields["end_date"] = str(ed)

            metrics_path = run_dir / "artifacts" / "metrics.csv"
            if metrics_path.exists():
                try:
                    with open(metrics_path, "r", encoding="utf-8") as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            for metric_key, db_col in (
                                ("total_return", "total_return"),
                                ("sharpe", "sharpe"),
                                ("max_drawdown", "max_drawdown"),
                                ("annual_return", "annual_return"),
                                ("win_rate", "win_rate"),
                                ("final_value", "final_value"),
                            ):
                                val = row.get(metric_key)
                                if val is not None and val != "":
                                    try:
                                        fields[db_col] = float(val)
                                    except (ValueError, TypeError):
                                        pass
                            tc = row.get("trade_count")
                            if tc is not None and tc != "":
                                try:
                                    fields["trade_count"] = int(float(tc))
                                except (ValueError, TypeError):
                                    pass
                            metrics_json = {k: v for k, v in row.items() if v is not None and v != ""}
                            if metrics_json:
                                fields["metrics_json"] = json.dumps(metrics_json, ensure_ascii=False)
                            break
                except (OSError, ValueError):
                    pass

            if "_" in run_id:
                parts = run_id.split("_")
                for d_str, t_str in ((parts[0], parts[1]) if len(parts) >= 2 else (None, None),):
                    if d_str and t_str and len(d_str) == 8 and len(t_str) >= 6:
                        try:
                            dt = datetime(
                                int(d_str[:4]), int(d_str[4:6]), int(d_str[6:8]),
                                int(t_str[:2]), int(t_str[2:4]), int(t_str[4:6]),
                            )
                            fields["created_at"] = dt.isoformat()
                        except (ValueError, IndexError):
                            pass

            self.upsert_run(run_id, **fields)
        except Exception as exc:
            logger.debug("sync_run_from_dir failed for %s: %s", run_id, exc)

    def _reconnect(self) -> None:
        try:
            if self._conn and not self._conn.closed:
                self._conn.rollback()
            else:
                import psycopg2

                self._conn = psycopg2.connect(DATABASE_URL)
                self._conn.autocommit = True
        except Exception:
            self._available = False


def _load_json_file(path: Path) -> Optional[dict[str, Any]]:
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return None


_db_instance: Optional[DatabaseBackend] = None


def get_db() -> DatabaseBackend:
    global _db_instance
    if _db_instance is None:
        _db_instance = DatabaseBackend()
    return _db_instance

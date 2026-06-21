"""Database layer: PostgreSQL-backed run/session metadata with file fallback.

When PostgreSQL is unavailable the module degrades to the existing
file-based storage, so the application never crashes due to a missing
database connection.

Configuration via environment variables:

- ``DATABASE_URL``: PostgreSQL connection string (default: ``postgresql://vibe:vibe@localhost:5432/vibe_trading``)
"""

from src.db.database import get_db, DatabaseBackend

__all__ = ["get_db", "DatabaseBackend"]

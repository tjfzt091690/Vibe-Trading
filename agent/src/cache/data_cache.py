"""Market data caching layer — wraps any DataLoader with Redis/dict caching.

Before calling the real data source, checks the cache for previously fetched
OHLCV bars.  Cache key format::

    ohlcv:{source}:{code}:{interval}:{start_date}:{end_date}

TTL defaults to 4 hours (market data becomes stale quickly) but is
configurable via ``MARKET_DATA_CACHE_TTL`` env var.
"""

from __future__ import annotations

import hashlib
import logging
import os
from typing import Any

import pandas as pd

from src.cache.redis_cache import get_cache, CacheBackend

logger = logging.getLogger(__name__)

MARKET_DATA_CACHE_TTL = int(os.getenv("MARKET_DATA_CACHE_TTL", "14400"))


def _cache_key(source: str, code: str, interval: str, start_date: str, end_date: str) -> str:
    raw = f"{source}:{code}:{interval}:{start_date}:{end_date}"
    digest = hashlib.md5(raw.encode()).hexdigest()[:12]
    return f"ohlcv:{source}:{code}:{interval}:{digest}"


def _df_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    df = df.copy()
    df.index = df.index.astype(str)
    return df.reset_index().to_dict(orient="records")


def _records_to_df(records: list[dict[str, Any]]) -> pd.DataFrame:
    df = pd.DataFrame(records)
    date_col = df.columns[0]
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.set_index(date_col)
    for col in ("open", "high", "low", "close", "volume"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


class CachedDataLoader:
    """Wraps a DataLoader instance with transparent caching.

    Usage::

        from backtest.loaders.akshare_loader import DataLoader as AkshareLoader
        from src.cache.data_cache import CachedDataLoader

        loader = CachedDataLoader(AkshareLoader())
        data = loader.fetch(["000001.SZ"], "2024-01-01", "2024-12-31")
    """

    def __init__(self, loader: Any, cache: CacheBackend | None = None, ttl: int | None = None) -> None:
        self._loader = loader
        self._cache = cache or get_cache()
        self._ttl = ttl or MARKET_DATA_CACHE_TTL
        self.name = getattr(loader, "name", "unknown")
        self.markets = getattr(loader, "markets", set())
        self.requires_auth = getattr(loader, "requires_auth", False)

    def is_available(self) -> bool:
        return self._loader.is_available()

    def fetch(
        self,
        codes: list[str],
        start_date: str,
        end_date: str,
        *,
        interval: str = "1D",
        fields: list[str] | None = None,
    ) -> dict[str, pd.DataFrame]:
        result: dict[str, pd.DataFrame] = {}
        missed: list[str] = []

        for code in codes:
            key = _cache_key(self.name, code, interval, start_date, end_date)
            cached = self._cache.get(key)
            if cached is not None:
                try:
                    result[code] = _records_to_df(cached)
                    continue
                except Exception as exc:
                    logger.debug("Cache deserialization failed for %s: %s", key, exc)
            missed.append(code)

        if missed:
            logger.info("Cache miss for %d/%d codes, fetching from %s", len(missed), len(codes), self.name)
            fetched = self._loader.fetch(missed, start_date, end_date, interval=interval, fields=fields)
            for code, df in fetched.items():
                result[code] = df
                key = _cache_key(self.name, code, interval, start_date, end_date)
                try:
                    self._cache.set(key, _df_to_records(df), ttl=self._ttl)
                except Exception as exc:
                    logger.debug("Cache write failed for %s: %s", key, exc)

        return result

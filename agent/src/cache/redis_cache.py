"""Redis cache with automatic in-memory fallback.

Usage::

    from src.cache import get_cache

    cache = get_cache()
    cache.set("key", value, ttl=3600)
    result = cache.get("key")

Configuration via environment variables:

- ``REDIS_URL``: Redis connection URL (default: ``redis://localhost:6379/0``)
- ``REDIS_PASSWORD``: Optional password
- ``REDIS_TTL_DEFAULT``: Default TTL in seconds (default: 3600)
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
REDIS_TTL_DEFAULT = int(os.getenv("REDIS_TTL_DEFAULT", "3600"))


class CacheBackend:
    """Unified cache interface with Redis primary + in-memory fallback."""

    def __init__(self) -> None:
        self._redis: Any = None
        self._redis_available: bool = False
        self._memory: dict[str, tuple[float, Any]] = {}
        self._init_redis()

    def _init_redis(self) -> None:
        try:
            import redis as _redis

            kwargs: dict[str, Any] = {"decode_responses": True}
            if REDIS_PASSWORD:
                kwargs["password"] = REDIS_PASSWORD

            self._redis = _redis.from_url(REDIS_URL, **kwargs)
            self._redis.ping()
            self._redis_available = True
            logger.info("Redis cache connected: %s", REDIS_URL)
        except Exception as exc:
            self._redis = None
            self._redis_available = False
            logger.warning(
                "Redis unavailable (%s), falling back to in-memory cache",
                exc,
            )

    @property
    def is_redis(self) -> bool:
        return self._redis_available

    def get(self, key: str) -> Optional[Any]:
        if self._redis_available:
            return self._redis_get(key)
        return self._memory_get(key)

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        if ttl is None:
            ttl = REDIS_TTL_DEFAULT
        if self._redis_available:
            self._redis_set(key, value, ttl)
        else:
            self._memory_set(key, value, ttl)

    def delete(self, key: str) -> None:
        if self._redis_available:
            try:
                self._redis.delete(key)
            except Exception:
                pass
        else:
            self._memory.pop(key, None)

    def delete_pattern(self, pattern: str) -> int:
        if self._redis_available:
            try:
                keys = self._redis.keys(pattern)
                if keys:
                    return self._redis.delete(*keys)
            except Exception:
                pass
            return 0
        prefix = pattern.replace("*", "")
        to_delete = [k for k in self._memory if k.startswith(prefix)]
        for k in to_delete:
            del self._memory[k]
        return len(to_delete)

    def _redis_get(self, key: str) -> Optional[Any]:
        try:
            raw = self._redis.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as exc:
            logger.debug("Redis GET error for %s: %s", key, exc)
            return None

    def _redis_set(self, key: str, value: Any, ttl: int) -> None:
        try:
            self._redis.setex(key, ttl, json.dumps(value, ensure_ascii=False, default=str))
        except Exception as exc:
            logger.debug("Redis SET error for %s: %s", key, exc)
            self._memory_set(key, value, ttl)

    def _memory_get(self, key: str) -> Optional[Any]:
        entry = self._memory.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.monotonic() > expires_at:
            del self._memory[key]
            return None
        return value

    def _memory_set(self, key: str, value: Any, ttl: int) -> None:
        self._memory[key] = (time.monotonic() + ttl, value)
        _evict_expired(self._memory)


def _evict_expired(memory: dict[str, tuple[float, Any]], max_entries: int = 500) -> None:
    if len(memory) < max_entries:
        return
    now = time.monotonic()
    expired = [k for k, (exp, _) in memory.items() if now > exp]
    for k in expired:
        del memory[k]
    if len(memory) >= max_entries:
        sorted_keys = sorted(memory.keys(), key=lambda k: memory[k][0])
        for k in sorted_keys[: len(memory) - max_entries // 2]:
            del memory[k]


_cache_instance: Optional[CacheBackend] = None


def get_cache() -> CacheBackend:
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = CacheBackend()
    return _cache_instance

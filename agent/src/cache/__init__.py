"""Cache layer: Redis-backed with in-memory fallback.

When Redis is unavailable the module degrades transparently to a
process-local dict cache, so the application never crashes due to
a missing Redis connection.
"""

from src.cache.redis_cache import get_cache, CacheBackend

__all__ = ["get_cache", "CacheBackend"]

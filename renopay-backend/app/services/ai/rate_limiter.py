"""
In-memory rate limiter for default platform-level Groq API usage.
Limits requests per user (e.g., 20 requests/hour) to protect platform quota.
BYO API key users bypass this limiter entirely.
"""
import time
from collections import defaultdict
from fastapi import HTTPException, status
from app.core.config import settings

# user_id -> list of query timestamps in seconds
_user_query_timestamps: dict[str, list[float]] = defaultdict(list)
WINDOW_SECONDS = 3600  # 1 hour window


def check_and_increment_rate_limit(user_id: str, limit: int | None = None) -> int:
    """
    Checks if user has exceeded their hourly quota for the platform default model.
    Raises HTTP 429 if exceeded. Returns remaining queries for the hour.
    """
    max_queries = limit or settings.AI_HOURLY_RATE_LIMIT
    now = time.time()
    cutoff = now - WINDOW_SECONDS

    # Clean old timestamps
    timestamps = [t for t in _user_query_timestamps[str(user_id)] if t > cutoff]
    _user_query_timestamps[str(user_id)] = timestamps

    if len(timestamps) >= max_queries:
        oldest = timestamps[0]
        retry_after_min = max(1, int((oldest + WINDOW_SECONDS - now) / 60))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Hourly free AI limit reached ({max_queries} queries/hour). "
                f"Resets in ~{retry_after_min} minutes. "
                "To get unlimited queries without rate limits, add your own API key in AI Assistant Setup!"
            ),
        )

    # Record this query
    _user_query_timestamps[str(user_id)].append(now)
    return max_queries - len(_user_query_timestamps[str(user_id)])


def get_user_rate_limit_status(user_id: str, limit: int | None = None) -> dict:
    """
    Returns current rate limit status for display in the UI.
    """
    max_queries = limit or settings.AI_HOURLY_RATE_LIMIT
    now = time.time()
    cutoff = now - WINDOW_SECONDS

    timestamps = [t for t in _user_query_timestamps.get(str(user_id), []) if t > cutoff]
    return {
        "used": len(timestamps),
        "limit": max_queries,
        "remaining": max(0, max_queries - len(timestamps)),
        "resets_in_seconds": max(0, int(timestamps[0] + WINDOW_SECONDS - now)) if timestamps else 0,
    }

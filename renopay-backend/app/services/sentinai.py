"""
SentinAI — rule-based fraud scoring, mirroring the heuristics from the
mock frontend (odd hours, new device, geo-velocity, high amount, fast
note-entry) but running server-side where it can't be bypassed by a
tampered client. Every call is logged to `fraud_events` for audit.

Upgrade path: once there's enough real/synthetic transaction volume,
swap `analyze()`'s rule block for a trained scikit-learn model fed the
same engineered features — the function signature and FraudVerdict
shape stay identical, so nothing upstream has to change.
"""
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.core.config import settings


@dataclass
class FraudVerdict:
    risk_level: str          # "low" | "medium" | "high"
    risk_flags: list[str] = field(default_factory=list)
    explanations: list[str] = field(default_factory=list)
    trust_score: int = 95
    blocked: bool = False
    new_device: bool = False
    geo_alert: bool = False


def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    """Real distance calc — the mock used a flat-plane approximation
    (`(lat*111)^2 + (lng*111)^2`) which breaks down over long
    distances. Haversine is correct at any distance."""
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def analyze(
    *,
    amount_paise: int,
    is_new_device: bool,
    last_lat: float | None,
    last_lng: float | None,
    last_location_at: datetime | None,
    current_lat: float | None,
    current_lng: float | None,
    note_slide_ms: int | None = None,
    note_count: int = 0,
    device_tilt_deg: float | None = None,
    now: datetime | None = None,
) -> FraudVerdict:
    """`now` defaults to the real current time in production. Tests pass
    a fixed value so the "odd hours" check doesn't flake depending on
    what time it happens to be when the suite runs — the mock's original
    `new Date().getHours()` had exactly this flakiness problem."""
    now = now or datetime.now(timezone.utc)
    flags: list[str] = []
    explanations: list[str] = []

    # 1. High amount
    if amount_paise > settings.HIGH_VALUE_TXN_PAISE:
        flags.append("high_amount")
        explanations.append("High value transaction")

    # 2. Odd hours (1–4 AM)
    from datetime import timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    ist_hour = now.astimezone(IST).hour
    if 1 <= ist_hour <= 4:
        flags.append("odd_hours")
        explanations.append(f"Transaction at {ist_hour}:00 IST — odd hours")

    # 3. New / unrecognized device
    if is_new_device:
        flags.append("new_device")
        explanations.append("Unrecognized device — not in trusted list")

    # 4. Geo-velocity: impossible travel between last known location and now
    if last_lat is not None and current_lat is not None and last_location_at is not None:
        dist_km = _haversine_km(last_lat, last_lng, current_lat, current_lng)
        elapsed_hrs = (now - last_location_at).total_seconds() / 3600
        if dist_km > 200 and elapsed_hrs < 2:
            flags.append("geo_velocity")
            explanations.append(
                f"Impossible travel: {dist_km:.0f}km in {elapsed_hrs * 60:.0f}min"
            )

    # 5. Bot-speed note entry (Advanced Pay drag-and-drop)
    if note_slide_ms is not None and note_count > 0 and (note_slide_ms / note_count) < 400:
        flags.append("bot_speed")
        explanations.append("Unusually fast note input detected")

    # 6. Device tilt anomaly (accelerometer-based liveness signal)
    if device_tilt_deg is not None and abs(device_tilt_deg) > 45:
        flags.append("unusual_tilt")
        explanations.append("Device tilt anomaly")

    blocked_reasons = {"bot_speed", "geo_velocity"}
    blocked = bool(set(flags) & blocked_reasons) and len(flags) >= 2

    if len(flags) == 0:
        risk_level = "low"
        trust_score = 93 + (hash(str(amount_paise)) % 7)  # deterministic jitter, 93-99
    elif len(flags) == 1:
        risk_level = "medium"
        trust_score = 75 + (hash(str(amount_paise)) % 15)
    else:
        risk_level = "high"
        trust_score = 40 + (hash(str(amount_paise)) % 30)

    return FraudVerdict(
        risk_level=risk_level,
        risk_flags=flags,
        explanations=explanations,
        trust_score=trust_score,
        blocked=blocked,
        new_device=is_new_device,
        geo_alert="geo_velocity" in flags,
    )

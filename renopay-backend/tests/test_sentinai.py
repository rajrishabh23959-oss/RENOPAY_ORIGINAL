"""
SentinAI is pure functions over inputs — no DB needed, so these run
fast and are a good place to pin down the exact fraud-scoring rules.
"""
from datetime import datetime, timedelta, timezone

from app.services import sentinai


def test_low_risk_normal_transaction_is_not_blocked():
    noon = datetime(2026, 7, 11, 12, 0, tzinfo=timezone.utc)  # deterministic, well outside odd-hours window
    verdict = sentinai.analyze(
        amount_paise=50_00, is_new_device=False,
        last_lat=None, last_lng=None, last_location_at=None,
        current_lat=None, current_lng=None,
        now=noon,
    )
    assert verdict.risk_level == "low"
    assert verdict.blocked is False
    assert verdict.risk_flags == []


def test_high_amount_flags_but_does_not_block_alone():
    verdict = sentinai.analyze(
        amount_paise=500_000, is_new_device=False,  # ₹5,000 > HIGH_VALUE_TXN_PAISE
        last_lat=None, last_lng=None, last_location_at=None,
        current_lat=None, current_lng=None,
    )
    assert "high_amount" in verdict.risk_flags
    # A single flag alone should never block — blocking requires 2+ flags
    # including at least one from the "hard" set (bot_speed/geo_velocity)
    assert verdict.blocked is False


def test_new_device_is_flagged():
    verdict = sentinai.analyze(
        amount_paise=100_00, is_new_device=True,
        last_lat=None, last_lng=None, last_location_at=None,
        current_lat=None, current_lng=None,
    )
    assert verdict.new_device is True
    assert "new_device" in verdict.risk_flags


def test_geo_velocity_detects_impossible_travel():
    # Mumbai coordinates, "last seen" 30 minutes ago
    verdict = sentinai.analyze(
        amount_paise=100_00, is_new_device=False,
        last_lat=19.076, last_lng=72.877, last_location_at=datetime.now(timezone.utc) - timedelta(minutes=30),
        # Delhi coordinates "now" — ~1150km away, impossible in 30 min
        current_lat=28.613, current_lng=77.209,
    )
    assert verdict.geo_alert is True
    assert "geo_velocity" in verdict.risk_flags


def test_geo_velocity_ignores_plausible_travel():
    # Same city, tiny movement — should NOT trigger geo_velocity
    verdict = sentinai.analyze(
        amount_paise=100_00, is_new_device=False,
        last_lat=19.076, last_lng=72.877, last_location_at=datetime.now(timezone.utc) - timedelta(minutes=30),
        current_lat=19.080, current_lng=72.880,
    )
    assert verdict.geo_alert is False


def test_bot_speed_note_entry_is_flagged():
    verdict = sentinai.analyze(
        amount_paise=100_00, is_new_device=False,
        last_lat=None, last_lng=None, last_location_at=None,
        current_lat=None, current_lng=None,
        note_slide_ms=500, note_count=5,  # 100ms/note — inhumanly fast
    )
    assert "bot_speed" in verdict.risk_flags


def test_bot_speed_plus_geo_velocity_together_blocks():
    verdict = sentinai.analyze(
        amount_paise=100_00, is_new_device=False,
        last_lat=19.076, last_lng=72.877, last_location_at=datetime.now(timezone.utc) - timedelta(minutes=10),
        current_lat=28.613, current_lng=77.209,
        note_slide_ms=300, note_count=5,
    )
    assert verdict.blocked is True, "Two hard-signal flags together should block the transaction"


def test_odd_hours_transaction_is_flagged():
    # 21:30 UTC is 3:00 AM IST the next day
    three_am_ist = datetime(2026, 7, 11, 21, 30, tzinfo=timezone.utc)
    verdict = sentinai.analyze(
        amount_paise=50_00, is_new_device=False,
        last_lat=None, last_lng=None, last_location_at=None,
        current_lat=None, current_lng=None,
        now=three_am_ist,
    )
    assert "odd_hours" in verdict.risk_flags


def test_haversine_distance_is_accurate_for_known_cities():
    # Mumbai to Delhi is approximately 1150-1160km by great-circle distance
    dist = sentinai._haversine_km(19.076, 72.877, 28.613, 77.209)
    assert 1100 < dist < 1200

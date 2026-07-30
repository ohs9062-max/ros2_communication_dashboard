"""Topic 모니터링의 hz 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from typing import Any

from ros2_dashboard_backend.topic.models import (
    HZ_STATUS_NEVER_RECEIVED,
    HZ_STATUS_STALE,
    TOPIC_STATUS_ACTIVE,
)


def recent_timestamps(
    timestamps: list[float],
    *,
    now: float,
    window_sec: float,
) -> list[float]:
    """현재 계산 창 안에 남아 있는 수신 timestamp만 반환합니다."""
    earliest = now - window_sec
    return [timestamp for timestamp in timestamps if timestamp >= earliest]


def hz_status(
    *,
    last_received_at: float | None,
    now: float,
    stale_timeout_sec: float,
) -> tuple[float | None, bool, str]:
    """마지막 수신 시각으로 정상·미수신·stale 상태를 결정합니다."""
    if last_received_at is None:
        return None, False, HZ_STATUS_NEVER_RECEIVED

    age_sec = now - last_received_at
    if age_sec > stale_timeout_sec:
        return age_sec, True, HZ_STATUS_STALE

    return age_sec, False, TOPIC_STATUS_ACTIVE


def build_hz_snapshot(
    *,
    timestamps: list[float],
    last_received_at: float | None,
    window_sec: float,
    stale_timeout_sec: float,
    now: float,
) -> dict[str, Any]:
    """최근 수신 개수를 시간 창으로 나눠 Topic Hz 응답을 만듭니다."""
    message_count = len(timestamps)
    hz = 0.0
    if message_count > 0:
        hz = round(message_count / window_sec, 2)

    age_sec, is_stale, status = hz_status(
        last_received_at=last_received_at,
        now=now,
        stale_timeout_sec=stale_timeout_sec,
    )

    return {
        'received': last_received_at is not None,
        'message_count': message_count,
        'window_sec': window_sec,
        'hz': hz,
        'last_received_at': last_received_at,
        'age_sec': age_sec,
        'is_stale': is_stale,
        'status': status,
    }

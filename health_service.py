"""Validated health content, bounded cache, and Groq request controls."""

from __future__ import annotations

import json
import logging
import threading
import time
from collections import OrderedDict, deque
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ai_engine import AIServiceError, generate_health_info, get_setting
from zone_catalog import TOPIC_IDS

LOGGER = logging.getLogger("gesturedoc.health")
CONTENT_PATH = Path(__file__).parent / "content" / "health_topics.json"
CACHE_TTL_SECONDS = 86_400
CACHE_MAX_ENTRIES = 64
FAILURE_COOLDOWN_SECONDS = 15


@dataclass(frozen=True)
class HealthResult:
    topic_id: str
    label: str
    common_conditions: tuple[str, ...]
    common_symptoms: str
    prevention: str
    seek_care: str
    sources: tuple[tuple[str, str], ...]
    source_kind: str
    status: str
    notice: str | None = None


@dataclass(frozen=True)
class _CacheEntry:
    created_at: float
    result: HealthResult


def _load_content() -> dict[str, Any]:
    data = json.loads(CONTENT_PATH.read_text(encoding="utf-8"))
    topics = data.get("topics")
    if not isinstance(topics, dict) or set(topics) != TOPIC_IDS:
        missing = sorted(TOPIC_IDS - set(topics or {}))
        extra = sorted(set(topics or {}) - TOPIC_IDS)
        raise RuntimeError(f"Katalog konten tidak cocok; missing={missing}, extra={extra}")
    return data


_CONTENT = _load_content()
CONTENT_VERSION = str(_CONTENT["content_version"])
_CACHE: OrderedDict[tuple[str, str, str, str], _CacheEntry] = OrderedDict()
_CACHE_LOCK = threading.RLock()
_TOPIC_LOCKS = {topic_id: threading.Lock() for topic_id in TOPIC_IDS}
_FAILURE_UNTIL: dict[str, float] = {}
_CONCURRENCY = threading.BoundedSemaphore(2)
_REQUEST_TIMES: deque[float] = deque()


def _bool_setting(name: str, default: bool) -> bool:
    raw = get_setting(name, "true" if default else "false").lower()
    return raw in {"1", "true", "yes", "on"}


def _int_setting(name: str, default: int, lower: int, upper: int) -> int:
    try:
        return max(lower, min(int(get_setting(name, str(default))), upper))
    except ValueError:
        return default


def _fallback(topic_id: str, *, status: str, notice: str | None = None) -> HealthResult:
    topic = _CONTENT["topics"][topic_id]
    return HealthResult(
        topic_id=topic_id,
        label=topic["label"],
        common_conditions=tuple(topic["common_conditions"]),
        common_symptoms=topic["common_symptoms"],
        prevention=topic["prevention"],
        seek_care=topic["seek_care"],
        sources=tuple((source["title"], source["url"]) for source in topic["sources"]),
        source_kind="curated",
        status=status,
        notice=notice,
    )


def get_curated_health_info(topic_id: str) -> HealthResult:
    if topic_id not in TOPIC_IDS:
        raise ValueError("Topik kesehatan tidak dikenal.")
    return _fallback(topic_id, status="success")


def _cache_key(topic_id: str) -> tuple[str, str, str, str]:
    return (topic_id, "id", get_setting("GROQ_MODEL", "openai/gpt-oss-20b"), CONTENT_VERSION)


def _read_cache(key: tuple[str, str, str, str], now: float) -> HealthResult | None:
    with _CACHE_LOCK:
        entry = _CACHE.get(key)
        if entry is None:
            return None
        if now - entry.created_at >= CACHE_TTL_SECONDS:
            del _CACHE[key]
            return None
        _CACHE.move_to_end(key)
        return entry.result


def _write_cache(key: tuple[str, str, str, str], result: HealthResult, now: float) -> None:
    with _CACHE_LOCK:
        _CACHE[key] = _CacheEntry(now, result)
        _CACHE.move_to_end(key)
        while len(_CACHE) > CACHE_MAX_ENTRIES:
            _CACHE.popitem(last=False)


def _reserve_rate_slot(now: float) -> bool:
    maximum = _int_setting("AI_MAX_REQUESTS_PER_MINUTE", 30, 1, 120)
    with _CACHE_LOCK:
        while _REQUEST_TIMES and now - _REQUEST_TIMES[0] >= 60:
            _REQUEST_TIMES.popleft()
        if len(_REQUEST_TIMES) >= maximum:
            return False
        _REQUEST_TIMES.append(now)
        return True


def get_health_information(
    topic_id: str,
    *,
    force_retry: bool = False,
    clock: Callable[[], float] = time.monotonic,
    generator: Callable[..., dict[str, Any]] = generate_health_info,
) -> HealthResult:
    if topic_id not in TOPIC_IDS:
        raise ValueError("Topik kesehatan tidak dikenal.")
    if not _bool_setting("AI_ENABLED", True):
        return _fallback(topic_id, status="ai_disabled", notice="Mode informasi dasar aktif.")

    now = clock()
    key = _cache_key(topic_id)
    cached = _read_cache(key, now)
    if cached is not None:
        return cached
    if not force_retry and now < _FAILURE_UNTIL.get(topic_id, 0):
        return _fallback(topic_id, status="cooldown", notice="Informasi dasar ditampilkan selama jeda percobaan AI.")

    topic_lock = _TOPIC_LOCKS[topic_id]
    if not topic_lock.acquire(timeout=12):
        return _fallback(topic_id, status="busy", notice="Layanan sedang sibuk; informasi dasar ditampilkan.")
    try:
        now = clock()
        cached = _read_cache(key, now)
        if cached is not None:
            return cached
        if not _CONCURRENCY.acquire(blocking=False):
            return _fallback(topic_id, status="busy", notice="Layanan sedang sibuk; informasi dasar ditampilkan.")
        try:
            if not _reserve_rate_slot(now):
                return _fallback(topic_id, status="rate_limited", notice="Batas penggunaan aplikasi tercapai; informasi dasar ditampilkan.")
            topic = _CONTENT["topics"][topic_id]
            try:
                generated = generator(topic_id=topic_id, label=topic["label"], reference=topic)
            except AIServiceError as exc:
                cooldown = exc.retry_after_seconds or FAILURE_COOLDOWN_SECONDS
                with _CACHE_LOCK:
                    _FAILURE_UNTIL[topic_id] = clock() + cooldown
                LOGGER.warning("ai_request_failed category=%s topic=%s", exc.category, topic_id)
                return _fallback(topic_id, status=exc.category, notice=exc.public_message)
        finally:
            _CONCURRENCY.release()

        result = HealthResult(
            topic_id=topic_id,
            label=topic["label"],
            common_conditions=tuple(generated["common_conditions"]),
            common_symptoms=generated["common_symptoms"],
            prevention=generated["prevention"],
            seek_care=generated["seek_care"],
            sources=tuple((source["title"], source["url"]) for source in topic["sources"]),
            source_kind="ai",
            status="success",
        )
        _write_cache(key, result, clock())
        with _CACHE_LOCK:
            _FAILURE_UNTIL.pop(topic_id, None)
        return result
    finally:
        topic_lock.release()


def clear_runtime_state_for_tests() -> None:
    with _CACHE_LOCK:
        _CACHE.clear()
        _FAILURE_UNTIL.clear()
        _REQUEST_TIMES.clear()

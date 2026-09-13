import pytest

import health_service
from ai_engine import AIServiceError
from health_service import get_curated_health_info, get_health_information


@pytest.fixture(autouse=True)
def clean_runtime(monkeypatch):
    health_service.clear_runtime_state_for_tests()
    monkeypatch.setattr(health_service, "get_setting", lambda name, default="": default)
    yield
    health_service.clear_runtime_state_for_tests()


def generated_payload():
    return {
        "common_conditions": ["Hasil AI satu", "Hasil AI dua"],
        "common_symptoms": "Gejala hasil AI yang sudah tervalidasi.",
        "prevention": "Saran pencegahan hasil AI yang aman.",
        "seek_care": "Cari bantuan bila kondisi berat atau memburuk.",
    }


def test_curated_catalog_covers_every_topic():
    for topic_id in health_service.TOPIC_IDS:
        result = get_curated_health_info(topic_id)
        assert result.status == "success"
        assert result.source_kind == "curated"
        assert result.sources


def test_success_is_cached_and_generator_runs_once():
    calls = []

    def generator(**kwargs):
        calls.append(kwargs["topic_id"])
        return generated_payload()

    first = get_health_information("head", generator=generator, clock=lambda: 100.0)
    second = get_health_information("head", generator=generator, clock=lambda: 101.0)
    assert calls == ["head"]
    assert first == second
    assert first.source_kind == "ai"


def test_failure_is_not_success_cache_and_can_retry_after_cooldown():
    calls = []

    def generator(**_):
        calls.append(True)
        if len(calls) == 1:
            raise AIServiceError("unavailable", "AI sedang gagal")
        return generated_payload()

    first = get_health_information("head", generator=generator, clock=lambda: 10.0)
    cooldown = get_health_information("head", generator=generator, clock=lambda: 11.0)
    retried = get_health_information("head", generator=generator, clock=lambda: 30.0)
    assert first.status == "unavailable" and first.source_kind == "curated"
    assert cooldown.status == "cooldown"
    assert retried.status == "success" and retried.source_kind == "ai"
    assert len(calls) == 2


def test_ai_disabled_never_calls_generator(monkeypatch):
    monkeypatch.setattr(
        health_service,
        "get_setting",
        lambda name, default="": "false" if name == "AI_ENABLED" else default,
    )
    result = get_health_information("head", generator=lambda **_: pytest.fail("must not call"))
    assert result.status == "ai_disabled"
    assert result.source_kind == "curated"


def test_unknown_topic_is_rejected_before_generator():
    with pytest.raises(ValueError):
        get_health_information("unknown", generator=lambda **_: pytest.fail("must not call"))

import json
from types import SimpleNamespace

import pytest

import ai_engine
from ai_engine import AIServiceError, generate_health_info, validate_ai_payload


def valid_payload():
    return {
        "common_conditions": ["Kondisi umum", "Keluhan ringan"],
        "common_symptoms": "Keluhan dapat berbeda pada setiap orang.",
        "prevention": "Jaga kebiasaan sehat dan hindari pemicu.",
        "seek_care": "Cari bantuan bila keluhan berat atau memburuk.",
    }


def test_payload_validation_accepts_exact_plain_schema():
    assert validate_ai_payload(valid_payload()) == valid_payload()


@pytest.mark.parametrize(
    "mutator",
    [
        lambda p: p.update(extra="bad"),
        lambda p: p.update(common_conditions=["Satu"]),
        lambda p: p.update(common_symptoms="<b>markup</b>"),
        lambda p: p.update(prevention="Baca https://example.com sekarang"),
        lambda p: p.update(seek_care=None),
    ],
)
def test_payload_validation_rejects_invalid_or_markup_content(mutator):
    payload = valid_payload()
    mutator(payload)
    with pytest.raises(AIServiceError) as caught:
        validate_ai_payload(payload)
    assert caught.value.category == "invalid_response"


def test_generate_uses_existing_model_json_mode_and_source_material(monkeypatch):
    captured = {}

    def create(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(valid_payload())))]
        )

    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(ai_engine, "_make_client", lambda: client)
    monkeypatch.setattr(ai_engine, "get_setting", lambda name, default="": default)
    result = generate_health_info(topic_id="head", label="Kepala", reference=valid_payload())
    assert result == valid_payload()
    assert captured["model"] == "openai/gpt-oss-20b"
    assert captured["response_format"] == {"type": "json_object"}
    assert captured["temperature"] == 0.2
    user_data = json.loads(captured["messages"][1]["content"])
    assert user_data["topic_id"] == "head"
    assert user_data["reference_material"]["seek_care"] == valid_payload()["seek_care"]


def test_generate_rejects_empty_model_response(monkeypatch):
    client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(
                create=lambda **_: SimpleNamespace(
                    choices=[SimpleNamespace(message=SimpleNamespace(content=""))]
                )
            )
        )
    )
    monkeypatch.setattr(ai_engine, "_make_client", lambda: client)
    with pytest.raises(AIServiceError) as caught:
        generate_health_info(topic_id="head", label="Kepala", reference=valid_payload())
    assert caught.value.category == "invalid_response"

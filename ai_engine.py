"""Groq adapter for generic, source-bounded health education content."""

from __future__ import annotations

import json
import logging
import os
import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from dotenv import load_dotenv
from groq import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    Groq,
    PermissionDeniedError,
    RateLimitError,
)

load_dotenv()
LOGGER = logging.getLogger("gesturedoc.ai")
DEFAULT_MODEL = "openai/gpt-oss-20b"
API_KEY_PLACEHOLDERS = frozenset({"gsk_your_key_here", "gsk_isi_key_produksi"})
EXPECTED_FIELDS = frozenset(
    {"common_conditions", "common_symptoms", "prevention", "seek_care"}
)


@dataclass(frozen=True)
class AIServiceError(Exception):
    category: str
    public_message: str
    retry_after_seconds: int | None = None

    def __str__(self) -> str:
        return self.public_message


def get_setting(name: str, default: str = "") -> str:
    """Read Streamlit secrets first and environment variables second."""
    try:
        import streamlit as st

        value = st.secrets.get(name, "")
        if value is not None and str(value).strip():
            return str(value).strip()
    except (FileNotFoundError, KeyError, RuntimeError):
        pass
    return os.getenv(name, default).strip()


def _make_client() -> Groq:
    api_key = get_setting("GROQ_API_KEY")
    if not api_key or api_key in API_KEY_PLACEHOLDERS or not api_key.startswith("gsk_") or len(api_key) < 30:
        raise AIServiceError(
            "configuration_error",
            "Groq API key belum valid. Informasi dasar ditampilkan.",
        )
    try:
        timeout = float(get_setting("GROQ_TIMEOUT_SECONDS", "10"))
    except ValueError:
        timeout = 10.0
    return Groq(api_key=api_key, timeout=max(3.0, min(timeout, 20.0)), max_retries=0)


def _plain_text(value: Any, field: str, *, minimum: int = 8, maximum: int = 600) -> str:
    if not isinstance(value, str):
        raise AIServiceError("invalid_response", f"Field {field} tidak berupa teks.")
    text = re.sub(r"\s+", " ", value).strip()
    if not minimum <= len(text) <= maximum:
        raise AIServiceError("invalid_response", f"Panjang field {field} tidak valid.")
    if re.search(r"<[^>]*>|https?://|\[[^]]+\]\([^)]*\)", text, re.IGNORECASE):
        raise AIServiceError("invalid_response", f"Field {field} memuat markup atau tautan.")
    return text


def validate_ai_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, Mapping) or set(payload) != EXPECTED_FIELDS:
        raise AIServiceError("invalid_response", "Struktur jawaban AI tidak sesuai.")
    conditions = payload.get("common_conditions")
    if not isinstance(conditions, list) or not 2 <= len(conditions) <= 3:
        raise AIServiceError("invalid_response", "Daftar kondisi AI tidak sesuai.")
    clean_conditions = [
        _plain_text(item, f"common_conditions[{index}]", minimum=3, maximum=100)
        for index, item in enumerate(conditions)
    ]
    return {
        "common_conditions": clean_conditions,
        "common_symptoms": _plain_text(payload.get("common_symptoms"), "common_symptoms"),
        "prevention": _plain_text(payload.get("prevention"), "prevention"),
        "seek_care": _plain_text(payload.get("seek_care"), "seek_care"),
    }


def _retry_after(exc: RateLimitError) -> int | None:
    try:
        value = exc.response.headers.get("retry-after")
        return max(1, min(int(float(value)), 300)) if value else None
    except (AttributeError, TypeError, ValueError):
        return None


def generate_health_info(
    *, topic_id: str, label: str, reference: Mapping[str, Any]
) -> dict[str, Any]:
    """Generate a bounded Indonesian explanation using the existing Groq API."""
    reference_payload = {key: reference[key] for key in EXPECTED_FIELDS if key in reference}
    system_prompt = (
        "Anda adalah editor informasi kesehatan edukatif berbahasa Indonesia. "
        "Anda tidak mendiagnosis, tidak memberi dosis obat, dan tidak menambah fakta "
        "di luar materi rujukan. Sederhanakan materi tanpa menghilangkan tanda bahaya. "
        "Kembalikan hanya JSON dengan empat field: common_conditions berupa array 2-3 "
        "string, common_symptoms, prevention, dan seek_care berupa string."
    )
    user_prompt = json.dumps(
        {"topic_id": topic_id, "label": label, "reference_material": reference_payload},
        ensure_ascii=False,
    )
    try:
        response = _make_client().chat.completions.create(
            model=get_setting("GROQ_MODEL", DEFAULT_MODEL),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            max_tokens=500,
            temperature=0.2,
        )
        content = response.choices[0].message.content
        if not content:
            raise AIServiceError("invalid_response", "Jawaban AI kosong.")
        try:
            payload = json.loads(content)
        except json.JSONDecodeError as exc:
            raise AIServiceError("invalid_response", "Jawaban AI bukan JSON valid.") from exc
        return validate_ai_payload(payload)
    except AIServiceError:
        raise
    except RateLimitError as exc:
        raise AIServiceError(
            "rate_limited",
            "Batas penggunaan AI sedang tercapai. Informasi dasar ditampilkan.",
            _retry_after(exc),
        ) from exc
    except (AuthenticationError, PermissionDeniedError) as exc:
        raise AIServiceError(
            "configuration_error",
            "Groq menolak API key yang dikonfigurasi. Informasi dasar ditampilkan.",
        ) from exc
    except (APITimeoutError, APIConnectionError) as exc:
        raise AIServiceError(
            "unavailable",
            "Layanan AI belum merespons. Informasi dasar ditampilkan.",
        ) from exc
    except APIStatusError as exc:
        category = "configuration_error" if exc.status_code in {400, 404, 422} else "unavailable"
        raise AIServiceError(
            category,
            "Layanan AI tidak tersedia untuk sementara. Informasi dasar ditampilkan.",
        ) from exc
    except (IndexError, AttributeError, TypeError) as exc:
        raise AIServiceError(
            "invalid_response",
            "Jawaban AI tidak dapat dibaca. Informasi dasar ditampilkan.",
        ) from exc


def get_health_info(zone_name: str) -> str:
    """Compatibility wrapper for the former pipe-separated public function."""
    reference = {
        "common_conditions": ["Keluhan umum", "Iritasi atau ketegangan"],
        "common_symptoms": "Gejala berbeda pada setiap orang dan perlu dinilai sesuai keadaan.",
        "prevention": "Jaga kebiasaan sehat dan hindari pemicu yang diketahui.",
        "seek_care": "Cari pertolongan bila gejala berat, mendadak, atau memburuk.",
    }
    try:
        data = generate_health_info(topic_id=zone_name, label=zone_name, reference=reference)
    except AIServiceError as exc:
        return (
            f"ZONA: {zone_name}|KONDISI UMUM: {exc.public_message}|GEJALA: -|"
            "SARAN: Gunakan informasi dasar aplikasi|KE DOKTER JIKA: Keluhan berat atau memburuk"
        )
    return (
        f"ZONA: {zone_name}|KONDISI UMUM: {', '.join(data['common_conditions'])}|"
        f"GEJALA: {data['common_symptoms']}|SARAN: {data['prevention']}|"
        f"KE DOKTER JIKA: {data['seek_care']}"
    )

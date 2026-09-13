"""GestureDoc: browser vision plus bounded Groq health education."""

from __future__ import annotations

import html
import logging
import os
import time

import streamlit as st
import streamlit.components.v1 as components

from ai_engine import get_setting
from health_service import HealthResult, get_health_information
from session_logic import (
    PROTOCOL_VERSION,
    accept_component_event,
    apply_component_event,
    parse_component_event,
    reset_selection,
)
from zone_catalog import get_zone, manual_options, public_catalog

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
LOGGER = logging.getLogger("gesturedoc.app")
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")
gesture_component = components.declare_component("gesture_doc", path=FRONTEND_DIR)

st.set_page_config(
    page_title="GestureDoc — Informasi Kesehatan",
    page_icon="🩺",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
    <style>
      .stApp { background: radial-gradient(circle at top, #111d36 0, #0b1020 40%); }
      .block-container { max-width: 1240px; padding-top: 1.25rem; padding-bottom: 2rem; }
      h1, h2, h3 { letter-spacing: -0.025em; }
      [data-testid="stAlert"] { border-radius: 12px; }
      .result-card { border: 1px solid #24324f; border-radius: 16px; padding: 1rem 1.1rem;
                     background: rgba(18, 26, 45, .72); margin-bottom: .75rem; }
      .result-label { color: #8da4c7; font-size: .78rem; text-transform: uppercase;
                      letter-spacing: .08em; margin-bottom: .25rem; }
      .result-value { color: #f3f7ff; line-height: 1.55; }
      footer, #MainMenu { visibility: hidden; }
      @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
    </style>
    """,
    unsafe_allow_html=True,
)

DEFAULTS = {
    "selected_zone_id": None,
    "health_result": None,
    "component_instance_id": None,
    "last_event_id": 0,
    "reset_revision": 0,
    "request_status": "idle",
    "last_request_started_at": 0.0,
    "last_event_rejection": None,
}
for key, value in DEFAULTS.items():
    if key not in st.session_state:
        st.session_state[key] = value


def _request_health(zone_id: str, *, force_retry: bool = False) -> None:
    zone = get_zone(zone_id)
    if zone is None:
        LOGGER.warning("selection_rejected reason=unknown_zone")
        return
    if (
        not force_retry
        and st.session_state.selected_zone_id == zone_id
        and st.session_state.health_result is not None
    ):
        return
    now = time.monotonic()
    if force_retry and now - st.session_state.last_request_started_at < 3:
        return
    st.session_state.selected_zone_id = zone_id
    st.session_state.request_status = "loading"
    st.session_state.last_request_started_at = now
    with st.spinner(f"Menyiapkan informasi untuk {zone.label}..."):
        result = get_health_information(zone.topic_id, force_retry=force_retry)
    st.session_state.health_result = result
    st.session_state.request_status = "ready"


def _result_card(label: str, value: str) -> None:
    st.markdown(
        f'<div class="result-card"><div class="result-label">{html.escape(label)}</div>'
        f'<div class="result-value">{html.escape(value)}</div></div>',
        unsafe_allow_html=True,
    )


def _render_result(result: HealthResult) -> None:
    badge = "✨ Ringkasan AI dari materi rujukan" if result.source_kind == "ai" else "📚 Informasi dasar"
    st.caption(badge)
    if result.notice:
        st.info(result.notice)
    conditions = " · ".join(result.common_conditions)
    _result_card("Kondisi yang umum dibahas", conditions)
    _result_card("Gejala yang dapat menyertai", result.common_symptoms)
    _result_card("Kebiasaan pencegahan", result.prevention)
    st.error(f"**Cari pertolongan medis:** {result.seek_care}")
    with st.expander("Sumber informasi dasar"):
        for title, url in result.sources:
            st.markdown(f"- [{title}]({url})")


st.title("🩺 GestureDoc")
st.caption("Pilih area tubuh dengan telunjuk atau kontrol manual untuk membaca informasi kesehatan umum.")
st.warning(
    "GestureDoc adalah media edukasi, bukan alat diagnosis. Kamera hanya diproses di browser oleh "
    "aplikasi dan tidak direkam. Nama area yang dipilih dikirim ke server; teks diproses oleh Groq "
    "saat AI tersedia. Untuk keadaan darurat, segera hubungi layanan darurat setempat."
)

col_camera, col_info = st.columns([1.45, 1], gap="large")

with col_camera:
    st.subheader("Kamera dan gesture")
    component_value = gesture_component(
        protocol_version=PROTOCOL_VERSION,
        reset_revision=st.session_state.reset_revision,
        selected_zone_id=st.session_state.selected_zone_id,
        request_status=st.session_state.request_status,
        interaction_enabled=st.session_state.request_status != "loading",
        catalog=public_catalog(),
        default=None,
        height=660,
        key="gesture-camera",
    )

    event, parse_error = parse_component_event(component_value)
    if parse_error:
        if component_value is not None and parse_error != st.session_state.last_event_rejection:
            LOGGER.warning("component_event_rejected reason=%s", parse_error)
            st.session_state.last_event_rejection = parse_error
    elif event is not None:
        accepted, reason = accept_component_event(event, st.session_state)
        if accepted:
            selected = apply_component_event(event, st.session_state)
            st.session_state.last_event_rejection = None
            if selected:
                _request_health(selected)
        elif reason != st.session_state.last_event_rejection:
            LOGGER.info("component_event_ignored reason=%s", reason)
            st.session_state.last_event_rejection = reason

with col_info:
    st.subheader("Informasi kesehatan")
    option_pairs = manual_options()
    option_ids = [zone_id for zone_id, _ in option_pairs]
    option_labels = dict(option_pairs)
    default_index = (
        option_ids.index(st.session_state.selected_zone_id)
        if st.session_state.selected_zone_id in option_ids
        else None
    )
    manual_zone = st.selectbox(
        "Pilih area tanpa kamera",
        options=option_ids,
        index=default_index,
        placeholder="Pilih area tubuh",
        format_func=lambda zone_id: option_labels[zone_id],
        disabled=st.session_state.request_status == "loading",
    )
    select_col, reset_col = st.columns(2)
    with select_col:
        manual_submit = st.button(
            "Tampilkan informasi",
            type="primary",
            use_container_width=True,
            disabled=manual_zone is None or st.session_state.request_status == "loading",
        )
    with reset_col:
        reset_clicked = st.button(
            "Reset pilihan",
            use_container_width=True,
            disabled=st.session_state.request_status == "loading",
        )

    if manual_submit and manual_zone:
        _request_health(manual_zone)
        st.rerun()
    if reset_clicked:
        reset_selection(st.session_state)
        st.rerun()

    selected_zone = get_zone(st.session_state.selected_zone_id or "")
    result = st.session_state.health_result
    if selected_zone:
        st.success(f"Area dipilih: **{selected_zone.label}**")
    else:
        st.info("Belum ada area dipilih. Gunakan kamera atau daftar manual di atas.")
    if isinstance(result, HealthResult):
        _render_result(result)
        if result.status != "success" and st.button("Coba AI lagi", use_container_width=True):
            _request_health(st.session_state.selected_zone_id, force_retry=True)
            st.rerun()

st.divider()
with st.expander("Cara menggunakan kamera dan batas kemampuan"):
    st.markdown(
        """
1. Tekan **Mulai kamera**, lalu izinkan akses kamera pada browser.
2. Pastikan satu orang terlihat dan pencahayaan cukup.
3. Luruskan telunjuk, arahkan ke titik area tubuh, dan tahan sekitar satu detik.
4. Gunakan **Stop kamera** setelah selesai. Anda selalu dapat memakai pilihan manual.

Deteksi hanya memperkirakan posisi area tubuh dari landmark permukaan. Aplikasi tidak melihat organ,
tidak membaca gejala dari kamera, dan tidak menentukan penyakit yang Anda alami. Hasil AI merangkum
materi informasi dasar; selalu pertimbangkan pemeriksaan tenaga kesehatan untuk keluhan pribadi.
        """
    )

st.caption(
    f"Model AI: {get_setting('GROQ_MODEL', 'openai/gpt-oss-20b')} · "
    "MediaPipe berjalan di perangkat · Tidak ada penyimpanan riwayat pengguna"
)

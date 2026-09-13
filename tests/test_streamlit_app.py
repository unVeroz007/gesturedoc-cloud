import os

from streamlit.testing.v1 import AppTest


def run_app():
    os.environ["AI_ENABLED"] = "false"
    return AppTest.from_file("app_streamlit.py", default_timeout=20).run()


def test_initial_render_and_manual_fallback_flow():
    app = run_app()
    assert not app.exception
    assert app.title[0].value == "🩺 GestureDoc"
    assert app.session_state["selected_zone_id"] is None

    app.selectbox[0].select("head")
    app.button[0].click().run()
    assert not app.exception
    assert app.session_state["selected_zone_id"] == "head"
    assert app.session_state["health_result"].source_kind == "curated"


def test_reset_invalidates_component_revision():
    app = run_app()
    app.selectbox[0].select("head")
    app.button[0].click().run()
    prior = app.session_state["reset_revision"]
    app.button[1].click().run()
    assert not app.exception
    assert app.session_state["selected_zone_id"] is None
    assert app.session_state["reset_revision"] == prior + 1

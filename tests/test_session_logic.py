import pytest

from session_logic import (
    PROTOCOL_VERSION,
    accept_component_event,
    apply_component_event,
    parse_component_event,
    reset_selection,
)


def raw_event(**overrides):
    value = {
        "protocol_version": PROTOCOL_VERSION,
        "component_instance_id": "instance-a",
        "event_id": 1,
        "reset_revision": 0,
        "type": "ready",
        "zone_id": None,
    }
    value.update(overrides)
    return value


@pytest.mark.parametrize(
    ("change", "reason"),
    [
        ({"protocol_version": 99}, "protocol_mismatch"),
        ({"type": "unknown"}, "event_type_invalid"),
        ({"component_instance_id": ""}, "instance_id_invalid"),
        ({"event_id": True}, "event_id_invalid"),
        ({"event_id": 0}, "event_id_invalid"),
        ({"reset_revision": -1}, "reset_revision_invalid"),
        ({"type": "zone_selected", "zone_id": "not-a-zone"}, "zone_invalid"),
        ({"type": "ready", "zone_id": "head"}, "ready_zone_forbidden"),
    ],
)
def test_invalid_component_events_are_rejected(change, reason):
    event, error = parse_component_event(raw_event(**change))
    assert event is None
    assert error == reason


def test_ready_registers_instance_then_selection_is_accepted_once():
    state = {"component_instance_id": None, "last_event_id": 0, "reset_revision": 0}
    ready, _ = parse_component_event(raw_event())
    assert accept_component_event(ready, state) == (True, None)
    assert apply_component_event(ready, state) is None

    selected, _ = parse_component_event(raw_event(type="zone_selected", zone_id="head", event_id=2))
    assert accept_component_event(selected, state) == (True, None)
    assert apply_component_event(selected, state) == "head"
    assert accept_component_event(selected, state) == (False, "duplicate_event")


def test_stale_instance_and_revision_are_rejected():
    state = {"component_instance_id": "instance-current", "last_event_id": 3, "reset_revision": 4}
    stale_instance, _ = parse_component_event(
        raw_event(type="zone_selected", zone_id="head", event_id=4, reset_revision=4)
    )
    stale_revision, _ = parse_component_event(
        raw_event(type="zone_selected", zone_id="head", event_id=5, reset_revision=3,
                  component_instance_id="instance-current")
    )
    assert accept_component_event(stale_instance, state) == (False, "stale_component_instance")
    assert accept_component_event(stale_revision, state) == (False, "stale_reset_revision")


def test_reset_clears_selection_and_invalidates_prior_component():
    state = {
        "selected_zone_id": "head",
        "health_result": object(),
        "component_instance_id": "instance-a",
        "last_event_id": 7,
        "reset_revision": 2,
        "request_status": "ready",
    }
    reset_selection(state)
    assert state == {
        "selected_zone_id": None,
        "health_result": None,
        "component_instance_id": None,
        "last_event_id": 0,
        "reset_revision": 3,
        "request_status": "idle",
    }

"""Pure state transitions for Streamlit/component events."""

from __future__ import annotations

from collections.abc import Mapping, MutableMapping
from dataclasses import dataclass
from typing import Any

from zone_catalog import ZONES

PROTOCOL_VERSION = 1
MAX_EVENT_BYTES = 2_048


@dataclass(frozen=True)
class ComponentEvent:
    event_type: str
    instance_id: str
    event_id: int
    reset_revision: int
    zone_id: str | None = None


def parse_component_event(raw: Any) -> tuple[ComponentEvent | None, str | None]:
    if not isinstance(raw, Mapping):
        return None, "event_not_object"
    if len(repr(dict(raw)).encode("utf-8")) > MAX_EVENT_BYTES:
        return None, "event_too_large"
    if raw.get("protocol_version") != PROTOCOL_VERSION:
        return None, "protocol_mismatch"
    event_type = raw.get("type")
    instance_id = raw.get("component_instance_id")
    event_id = raw.get("event_id")
    reset_revision = raw.get("reset_revision")
    zone_id = raw.get("zone_id")
    if event_type not in {"ready", "zone_selected"}:
        return None, "event_type_invalid"
    if not isinstance(instance_id, str) or not (1 <= len(instance_id) <= 80):
        return None, "instance_id_invalid"
    if isinstance(event_id, bool) or not isinstance(event_id, int) or not (1 <= event_id <= 2**31 - 1):
        return None, "event_id_invalid"
    if isinstance(reset_revision, bool) or not isinstance(reset_revision, int) or reset_revision < 0:
        return None, "reset_revision_invalid"
    if event_type == "zone_selected" and zone_id not in ZONES:
        return None, "zone_invalid"
    if event_type == "ready" and zone_id is not None:
        return None, "ready_zone_forbidden"
    return ComponentEvent(event_type, instance_id, event_id, reset_revision, zone_id), None


def accept_component_event(event: ComponentEvent, state: Mapping[str, object]) -> tuple[bool, str | None]:
    current_instance = state.get("component_instance_id")
    current_revision = state.get("reset_revision", 0)
    last_event_id = state.get("last_event_id", 0)
    if event.reset_revision != current_revision:
        return False, "stale_reset_revision"
    if event.event_type == "ready":
        if current_instance == event.instance_id and event.event_id <= last_event_id:
            return False, "duplicate_event"
        return True, None
    if current_instance != event.instance_id:
        return False, "stale_component_instance"
    if event.event_id <= last_event_id:
        return False, "duplicate_event"
    return True, None


def apply_component_event(event: ComponentEvent, state: MutableMapping[str, object]) -> str | None:
    if event.event_type == "ready":
        state["component_instance_id"] = event.instance_id
        state["last_event_id"] = event.event_id
        return None
    state["last_event_id"] = event.event_id
    return event.zone_id


def reset_selection(state: MutableMapping[str, object]) -> None:
    state["reset_revision"] = int(state.get("reset_revision", 0)) + 1
    state["selected_zone_id"] = None
    state["health_result"] = None
    state["last_event_id"] = 0
    state["component_instance_id"] = None
    state["request_status"] = "idle"

"""Single source of truth for visual targets and health topics."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Zone:
    zone_id: str
    topic_id: str
    label: str
    side: str | None
    source: str
    priority: int


_ZONES = (
    Zone("head", "head", "Kepala", None, "face", 30),
    Zone("eye_left", "eye_left", "Mata Kiri", "left", "face", 10),
    Zone("eye_right", "eye_right", "Mata Kanan", "right", "face", 10),
    Zone("nose", "nose", "Hidung", None, "face", 10),
    Zone("mouth", "mouth", "Mulut, Gigi, dan Tenggorokan", None, "face", 10),
    Zone("ear_left", "ear_left", "Area Telinga Kiri", "left", "face", 10),
    Zone("ear_right", "ear_right", "Area Telinga Kanan", "right", "face", 10),
    Zone("chin", "chin", "Dagu dan Rahang", None, "face", 10),
    Zone("neck", "neck", "Leher", None, "pose", 20),
    Zone("chest_lungs", "chest_lungs", "Dada dan Paru-paru", None, "pose", 40),
    Zone("heart", "heart", "Area Jantung", "left", "pose", 15),
    Zone("abdomen", "abdomen", "Perut", None, "pose", 35),
    Zone("hip", "hip", "Pinggul", None, "pose", 30),
    Zone("shoulder_left", "shoulder_left", "Bahu Kiri", "left", "pose", 15),
    Zone("shoulder_right", "shoulder_right", "Bahu Kanan", "right", "pose", 15),
    Zone("elbow_left", "elbow_left", "Siku Kiri", "left", "pose", 10),
    Zone("elbow_right", "elbow_right", "Siku Kanan", "right", "pose", 10),
    Zone("wrist_left", "wrist", "Pergelangan Tangan Kiri", "left", "pose", 10),
    Zone("wrist_right", "wrist", "Pergelangan Tangan Kanan", "right", "pose", 10),
    Zone("knee_left", "knee", "Lutut Kiri", "left", "pose", 10),
    Zone("knee_right", "knee", "Lutut Kanan", "right", "pose", 10),
    Zone("ankle_left", "ankle", "Pergelangan Kaki Kiri", "left", "pose", 10),
    Zone("ankle_right", "ankle", "Pergelangan Kaki Kanan", "right", "pose", 10),
)

ZONES = {zone.zone_id: zone for zone in _ZONES}
TOPIC_IDS = frozenset(zone.topic_id for zone in _ZONES)


def get_zone(zone_id: str) -> Zone | None:
    return ZONES.get(zone_id)


def public_catalog() -> list[dict[str, object]]:
    """Return metadata that is safe and useful inside the browser component."""
    return [asdict(zone) for zone in _ZONES]


def manual_options() -> list[tuple[str, str]]:
    return [(zone.zone_id, zone.label) for zone in _ZONES]

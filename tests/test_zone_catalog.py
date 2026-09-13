from zone_catalog import TOPIC_IDS, ZONES, manual_options, public_catalog


def test_catalog_has_23_visual_zones_and_20_topics():
    assert len(ZONES) == 23
    assert len(TOPIC_IDS) == 20
    assert len(public_catalog()) == 23
    assert len(manual_options()) == 23


def test_bilateral_joints_share_health_topics_without_sharing_visual_targets():
    assert ZONES["wrist_left"].topic_id == ZONES["wrist_right"].topic_id == "wrist"
    assert ZONES["knee_left"].topic_id == ZONES["knee_right"].topic_id == "knee"
    assert ZONES["ankle_left"].topic_id == ZONES["ankle_right"].topic_id == "ankle"
    assert ZONES["wrist_left"].label != ZONES["wrist_right"].label


def test_public_catalog_contains_no_prompt_or_secret_fields():
    for zone in public_catalog():
        assert set(zone) == {"zone_id", "topic_id", "label", "side", "source", "priority"}

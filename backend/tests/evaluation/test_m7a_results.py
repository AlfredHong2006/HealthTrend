"""Milestone 7A runners, committed evidence and the generated document. Test ID EV16.

Three guards, mirroring what EV8, EV10 and EV11 do for M6:

- the runners produce every configuration, rule and role the pre-registration names;
- the committed M7A result files were produced under the pre-registered constants in force
  now, so a threshold changed after the results were seen invalidates them loudly;
- ``docs/evaluation/m7a_results.md`` is exactly what the committed files render to, and the
  closed M6 document is untouched by M7A.
"""

from __future__ import annotations

import json

import pytest

from evaluation.common import DOCS_EVALUATION_DIR, RESULTS_DIR, round_for_json
from evaluation.experiments import e6_plan_alignment, e7_departure
from evaluation.m7a_tables import HEADER, render_all
from evaluation.plan_alignment import INNOVATION_RULES, PLAN_RULES, PREREGISTRATION
from evaluation.plan_scenarios import CHECKIN_DAYS

REGENERATE = "uv run python -m evaluation.run tables"
DOCUMENT = DOCS_EVALUATION_DIR / "m7a_results.md"
PREREGISTRATION_DOCUMENT = DOCS_EVALUATION_DIR / "m7a_preregistration.md"


@pytest.fixture(scope="module")
def smoke():
    return {"e6": e6_plan_alignment.run("smoke"), "e7": e7_departure.run("smoke")}


def test_ev16_e6_covers_every_configuration_and_method(smoke):
    results = smoke["e6"]["results"]
    assert set(results["configs"]) == {f"{r}/{s}" for r, s in e6_plan_alignment.CONFIGS}
    for entry in results["configs"].values():
        assert set(entry["methods"]) == {
            "kalman",
            "gated",
            "ols28",
            "weekly_means",
            "weekly_means_point",
        }
        assert set(entry["methods"]["kalman"]["by_checkin"]) == {f"{d:g}" for d in CHECKIN_DAYS}
    assert set(results["eligibility"]) == {"kalman", "gated"}


def test_ev16_e7_scores_every_rule_against_every_preregistered_role(smoke):
    results = smoke["e7"]["results"]
    assert set(results["plan_rules"]) == set(PLAN_RULES)
    assert set(results["innovation_rules"]) == set(INNOVATION_RULES)
    assert set(results["eligibility"]) == set(PLAN_RULES) | set(INNOVATION_RULES)
    for config, (role, _) in e7_departure.ROLES["innovation"].items():
        for rule in INNOVATION_RULES:
            assert results["innovation_rules"][rule][config]["role"] == role
    for rule in PLAN_RULES:
        table = results["plan_rules"][rule]
        for config, (role, _) in e7_departure.ROLES["plan"].items():
            placements = e7_departure.PLACEMENTS if role == "null" else {"centre": 0.0}
            for placement in placements:
                assert table[f"{config}@{placement}"]["role"] == role
        assert sum(1 for key in table if key.startswith("bad_reading/")) == 9


def test_ev16_the_runners_are_deterministic(smoke):
    from evaluation.common import to_json_text

    assert to_json_text(e7_departure.run("smoke")["results"]) == to_json_text(
        smoke["e7"]["results"]
    )


@pytest.mark.parametrize("stem", ["e6_plan_alignment", "e7_departure"])
def test_ev16_committed_results_were_produced_under_the_preregistered_rules(stem):
    """The pre-registration guard: change a threshold and the committed evidence stops counting."""
    payload = json.loads((RESULTS_DIR / f"{stem}.json").read_text(encoding="utf-8"))
    assert payload["_config"]["grid"]["preregistration"] == round_for_json(PREREGISTRATION)
    assert payload["_config"]["scale"] == "full"
    assert payload["_config"]["grid"]["n_series"] == 1000


def test_ev16_the_preregistration_document_states_the_thresholds_in_the_code():
    text = PREREGISTRATION_DOCUMENT.read_text(encoding="utf-8")
    for needle in (
        "w_prior <= 0.05",
        "0.2 kg/week",
        "`G = 3.0`",
        "0.05 / 9",
        "clip(z, -2, 2)",
        "`(c - 14, c]`",
        "<= 0.075",
        "<= 0.02",
        "ECE `<= 0.03`",
    ):
        assert needle in text, needle


def test_ev16_m7a_results_md_matches_the_committed_json():
    assert DOCUMENT.read_text(encoding="utf-8") == render_all(), (
        f"{DOCUMENT.name} is out of date; regenerate it with `{REGENERATE}` from `backend/`"
    )


def test_ev16_the_document_declares_itself_generated():
    text = DOCUMENT.read_text(encoding="utf-8")
    assert text.startswith(HEADER.split("\n", 1)[0])
    assert "DO NOT EDIT" in text
    assert "## E6 -" in text
    assert "## E7 -" in text


def test_ev16_the_m6_document_carries_no_m7a_section():
    """M6 is closed: its generated document must not have grown M7A content."""
    text = (DOCS_EVALUATION_DIR / "results.md").read_text(encoding="utf-8")
    assert "## E6" not in text
    assert "## E7" not in text

"""The experiment runners and the committed results. Test IDs EV8, EV10.

Two jobs. First, prove every experiment runs end to end and returns the shape the report
expects, at a scale small enough for CI -- structurally complete, statistically meaningless.
Second, tie the committed result files to the parameters and seeds that produced them, so a
future change to a prior invalidates the evidence loudly instead of leaving a stale file
that still looks authoritative.
"""

from __future__ import annotations

import json

import pytest

from app.core.types import ModelParams
from evaluation.common import (
    RESULTS_DIR,
    SEED_BASES,
    RunConfig,
    round_float,
    round_for_json,
    to_json_text,
)
from evaluation.run import EXPERIMENTS, RESULT_STEMS

SMOKE = "smoke"

EXPECTED_KEYS = {
    "e1": {"n_cases", "gate_passed", "recursions_agree", "max_recursion_rel_diff"},
    "e2": {"configurations", "assessment", "investigate"},
    "e34": {"cells", "e3_identifiability", "e4_recovery", "sigma_v0_sensitivity"},
    "e5": {"regimes", "summary", "n_beating_shipped"},
}


@pytest.fixture(scope="module")
def smoke():
    """Every experiment run once at smoke scale, shared across the tests that read it.

    Module-scoped because E3/E4 and E5 take seconds even at smoke scale, and a dozen tests
    asking the same runner the same question would multiply that for nothing.
    """
    return {name: runner(SMOKE) for name, runner in EXPERIMENTS.items()}


# --- EV8: every runner completes and returns what the report reads -----------------


@pytest.mark.parametrize("name", sorted(EXPERIMENTS))
def test_ev8_every_experiment_runs_at_smoke_scale(name, smoke):
    payload = smoke[name]
    assert set(payload) == {"_config", "results"}
    assert isinstance(payload["_config"], RunConfig)
    assert payload["_config"].scale == SMOKE
    assert EXPECTED_KEYS[name] <= set(payload["results"])


@pytest.mark.parametrize("name", sorted(EXPERIMENTS))
def test_ev8_every_experiment_is_deterministic(name, smoke):
    """A second run must produce an identical payload, before any rounding.

    Determinism is what lets a committed result be reviewed as evidence rather than as a
    snapshot of one afternoon. Compared through the serialiser so that a difference
    anywhere in the structure shows up, not just in the headline numbers.
    """
    repeated = EXPERIMENTS[name](SMOKE)
    assert to_json_text(repeated["results"]) == to_json_text(smoke[name]["results"])


def test_ev8_the_e1_gate_passes_at_smoke_scale(smoke):
    """E1 gates the rest of M6, so its verdict is asserted rather than merely produced."""
    results = smoke["e1"]["results"]
    assert results["recursions_agree"]
    assert results["oracle_agrees_where_conditioned"]
    assert results["gate_passed"]
    assert results["n_cases"] > 0


def test_ev8_the_e2_configurations_check_every_diagnostic(smoke):
    results = smoke["e2"]["results"]
    assert len(results["configurations"]) == 2
    for configuration in results["configurations"]:
        assert set(configuration["ci_contains_nominal"]) == {
            "coverage_w",
            "coverage_v",
            "anis",
            "anees",
        }
    assert results["assessment"]["n_checks"] == 8


def test_ev8_the_e34_views_come_from_the_same_cells(smoke):
    """E3 and E4 must be views, not separate computations, or they can disagree."""
    results = smoke["e34"]["results"]
    cells = results["cells"]
    assert results["n_cells"] == len(cells) == 12
    assert set(results["e3_identifiability"]["cells"]) == set(cells)
    for label, view in results["e4_recovery"]["cells"].items():
        assert cells[label]["on_diagonal"]
        assert view["n_obs"] == cells[label]["n_obs"]
    assert all(
        not cells[label]["on_diagonal"]
        for label in set(cells) - set(results["e4_recovery"]["cells"])
    )


def test_ev8_the_fitting_objective_is_verified_at_every_optimum(smoke):
    """The published discrepancy must be real and tiny, not absent."""
    results = smoke["e34"]["results"]
    assert results["max_objective_discrepancy"] < 1e-9
    for cell in results["cells"].values():
        assert "max_objective_discrepancy" in cell


def test_ev8_the_e5_comparison_covers_every_regime_and_method(smoke):
    results = smoke["e5"]["results"]
    from evaluation.baselines import METHODS
    from evaluation.scenarios import REGIMES

    assert set(results["regimes"]) == set(REGIMES)
    for entry in results["regimes"].values():
        assert set(entry["one_step"]["mae"]) == set(METHODS)
        assert set(entry["forecast30"]["mae"]) == set(METHODS)
        # Interval coverage exists only where an interval exists.
        assert set(entry["kalman_intervals"]["one_step_coverage"]) == {
            "kalman_shipped",
            "kalman_fitted",
        }
        assert entry["forecast30"]["achieved_horizon_days"]["min"] >= 30.0


def test_ev8_no_baseline_is_given_a_fabricated_interval(smoke):
    """The honest gap: four of the six methods cannot state one, and none is invented."""
    results = smoke["e5"]["results"]
    for entry in results["regimes"].values():
        for table in entry["kalman_intervals"].values():
            if isinstance(table, dict):
                assert not ({"locf", "moving_average", "ewma", "holt"} & set(table))


# --- EV8: serialisation ------------------------------------------------------------


def test_ev8_rounding_keeps_six_significant_digits_and_leaves_integers_alone():
    assert round_float(1.23456789) == 1.23457
    assert round_float(1.23456789e-9) == 1.23457e-9
    assert round_for_json({"count": 7, "flag": True, "value": 0.123456789}) == {
        "count": 7,
        "flag": True,
        "value": 0.123457,
    }
    assert round_for_json([1.0000001, (2.0, 3)]) == [1.0, [2.0, 3]]


def test_ev8_a_non_finite_result_is_refused_rather_than_committed():
    """An infinity in a results file means something failed silently upstream."""
    with pytest.raises(ValueError, match="not finite"):
        round_float(float("inf"))
    with pytest.raises(ValueError, match="not finite"):
        round_for_json({"broken": float("nan")})


def test_ev8_the_serialised_form_is_stable_and_sorted():
    text = to_json_text({"b": 1, "a": 2})
    assert text == '{\n  "a": 2,\n  "b": 1\n}\n'


# --- EV10: the committed results are not stale --------------------------------------


def _committed():
    return {
        name: RESULTS_DIR / f"{stem}.json"
        for name, stem in RESULT_STEMS.items()
        if (RESULTS_DIR / f"{stem}.json").exists()
    }


def test_ev10_the_committed_results_exist():
    """A missing result file is a study that was never run, or one that was deleted."""
    assert set(_committed()) == set(RESULT_STEMS), (
        "run `uv run python -m evaluation.run all` to regenerate the committed results"
    )


@pytest.mark.parametrize("name", sorted(RESULT_STEMS))
def test_ev10_committed_results_match_the_current_priors(name):
    """The staleness guard.

    ``ModelParams.default()`` determines every number in these files. If a prior changes,
    the committed evidence describes a model that no longer exists, and a reader has no way
    to tell from the file itself. Failing here forces the study to be rerun or the file to
    be removed -- either is honest; leaving it is not.
    """
    path = RESULTS_DIR / f"{RESULT_STEMS[name]}.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    config = payload["_config"]

    expected = round_for_json(ModelParams.default().to_dict())
    assert config["params"] == expected, (
        f"{path.name} was produced with different model parameters; "
        f"rerun `uv run python -m evaluation.run {name}`"
    )
    assert config["scale"] == "full"
    assert config["experiment"] == name


@pytest.mark.parametrize("name", sorted(RESULT_STEMS))
def test_ev10_committed_results_record_their_seed_blocks(name):
    """A result whose provenance is not recorded cannot be reproduced or audited."""
    path = RESULTS_DIR / f"{RESULT_STEMS[name]}.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    recorded = payload["_config"]["seed_ranges"]

    assert recorded, f"{path.name} records no seed blocks"
    for key, block in recorded.items():
        assert key in SEED_BASES, f"{path.name} names an unknown seed block {key!r}"
        assert block["base"] == SEED_BASES[key].base
        assert block["span"] == SEED_BASES[key].span


@pytest.mark.parametrize("name", sorted(RESULT_STEMS))
def test_ev10_committed_results_are_in_the_canonical_serialised_form(name):
    """Byte-stable formatting, so a diff shows a changed number and not a reflow."""
    path = RESULTS_DIR / f"{RESULT_STEMS[name]}.json"
    text = path.read_text(encoding="utf-8")
    assert text == to_json_text(json.loads(text))


def test_ev10_the_committed_e1_gate_passed():
    """The gate is recorded in the artefact, not only in a runner's console output."""
    payload = json.loads((RESULTS_DIR / f"{RESULT_STEMS['e1']}.json").read_text(encoding="utf-8"))
    assert payload["results"]["gate_passed"]
    assert payload["results"]["recursions_agree"]


def test_ev10_the_committed_e2_study_did_not_trigger_investigation():
    payload = json.loads((RESULTS_DIR / f"{RESULT_STEMS['e2']}.json").read_text(encoding="utf-8"))
    assert not payload["results"]["investigate"]

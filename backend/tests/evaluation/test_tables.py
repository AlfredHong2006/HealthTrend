"""The generated results document and the numbers behind it. Test ID EV11.

``docs/evaluation/results.md`` is generated from ``backend/evaluation/results/*.json`` and
carries a do-not-edit header, exactly as ``openapi.json`` does. A generated file that is
committed can go stale in two ways, and both of them are silent: somebody edits the markdown
instead of the source, or a rerun changes a result and nobody regenerates the tables. Either
leaves a document that still looks authoritative while reporting numbers the committed
evidence no longer contains.

So the same guard the API contract gets applies here: re-render from the committed JSON,
compare byte for byte, and fail with the command that fixes it. ``EV10`` ties the committed
JSON to the priors that produced it; this ties the prose tables to that JSON. Between them
there is no step in the chain from ``ModelParams.default()`` to a published number that can
drift unnoticed.
"""

from __future__ import annotations

import pytest

from evaluation.common import DOCS_EVALUATION_DIR, read_results
from evaluation.run import RESULT_STEMS
from evaluation.tables import HEADER, render_all

REGENERATE = "uv run python -m evaluation.run tables"

RESULTS_DOCUMENT = DOCS_EVALUATION_DIR / "results.md"


def test_ev11_the_generated_results_document_exists():
    assert RESULTS_DOCUMENT.exists(), f"missing {RESULTS_DOCUMENT.name}; run `{REGENERATE}`"


def test_ev11_results_md_matches_the_committed_json():
    """The staleness guard for the generated tables.

    Rendered in memory rather than written, so a failing run reports the drift instead of
    quietly repairing it -- the same reason the contract check regenerates into a comparison
    and not over the file.
    """
    rendered = render_all()
    committed = RESULTS_DOCUMENT.read_text(encoding="utf-8")
    assert committed == rendered, (
        f"{RESULTS_DOCUMENT.name} is out of date with the committed result files; "
        f"regenerate it with `{REGENERATE}` from `backend/`"
    )


def test_ev11_the_document_declares_itself_generated():
    """Without the header a reader has no way to know editing it is pointless."""
    committed = RESULTS_DOCUMENT.read_text(encoding="utf-8")
    assert committed.startswith(HEADER.split("\n", 1)[0])
    assert "DO NOT EDIT" in committed
    assert REGENERATE in committed


@pytest.mark.parametrize("name", sorted(RESULT_STEMS))
def test_ev11_every_committed_result_file_is_read_to_render_the_document(name):
    """A committed result file that nothing renders is evidence nobody can read."""
    assert read_results(RESULT_STEMS[name])["_config"]["experiment"] == name


@pytest.mark.parametrize("section", ["E1", "E2", "E3", "E4", "E5"])
def test_ev11_every_experiment_has_a_section(section):
    """Five experiments, five sections. ``e34`` renders as two, which is the point of it."""
    assert f"## {section} -" in render_all()

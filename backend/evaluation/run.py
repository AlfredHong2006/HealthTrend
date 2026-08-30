"""Command-line entry point for the M6 evaluation.

Run from ``backend/``::

    uv run python -m evaluation.run e1              # full scale, writes results/e1.json
    uv run python -m evaluation.run all             # every experiment, full scale
    uv run python -m evaluation.run all --smoke     # fast, writes nothing
    uv run python -m evaluation.run tables          # regenerate docs/evaluation/results.md

The experiments are deliberately not pytest tests. A full run takes tens of minutes,
which does not belong on every push; what the test suite runs is the smoke scale, which
exercises every code path at a size that establishes nothing statistically and everything
structurally.

``e34`` is a single target on purpose. E3 (identifiability across the span-by-count grid)
and E4 (parameter recovery on the daily diagonal) are two views of one set of maximum
likelihood fits, and fitting is by far the expensive part. Splitting them into two
commands would either compute the shared cells twice or make the output depend on which
was run last. One runner computes every cell exactly once and derives both views, so
``e34_estimation.json`` has one writer and one meaning.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Callable
from typing import Any, Final

from evaluation.common import RESULTS_DIR, write_results
from evaluation.experiments import (
    e1_exact_likelihood,
    e2_calibration,
    e5_baselines,
    e34_estimation,
)

FULL: Final = "full"
SMOKE: Final = "smoke"

EXPERIMENTS: Final[dict[str, Callable[[str], dict[str, Any]]]] = {
    "e1": e1_exact_likelihood.run,
    "e2": e2_calibration.run,
    "e34": e34_estimation.run,
    "e5": e5_baselines.run,
}
"""Experiment name to runner. The key is also the result filename stem."""

RESULT_STEMS: Final[dict[str, str]] = {
    "e1": "e1_exact_likelihood",
    "e2": "e2_calibration",
    "e34": "e34_estimation",
    "e5": "e5_baselines",
}
"""Experiment name to committed filename stem."""


def print_headline(name: str, results: dict[str, Any]) -> None:
    """Print the scalar top-level entries of a result payload.

    Deliberately generic: an experiment surfaces a headline by putting a scalar at the top
    level of its results, and gets it printed without :mod:`evaluation.run` knowing
    anything about what the experiment measures.
    """
    for key, value in results.items():
        if isinstance(value, bool | int | float | str):
            print(f"[{name}]   {key}: {value}")


def run_experiment(name: str, scale: str) -> dict[str, Any]:
    """Run one experiment and, at full scale, write its result file."""
    runner = EXPERIMENTS[name]
    print(f"[{name}] running at {scale} scale ...")
    payload = runner(scale)
    print_headline(name, payload["results"])
    if scale == FULL:
        config = payload["_config"]
        path = write_results(RESULT_STEMS[name], config, payload["results"])
        print(f"[{name}] wrote {path} ({path.stat().st_size} bytes)")
    else:
        print(f"[{name}] smoke run complete; nothing written")
    return payload


def render_tables() -> None:
    """Regenerate ``docs/evaluation/results.md`` from the committed result files."""
    from evaluation import tables

    path = tables.write_results_document()
    print(f"[tables] wrote {path} ({path.stat().st_size} bytes)")


def build_parser() -> argparse.ArgumentParser:
    """Return the argument parser."""
    parser = argparse.ArgumentParser(
        prog="python -m evaluation.run",
        description="Run one M6 evaluation experiment, or all of them.",
    )
    parser.add_argument(
        "target",
        choices=(*EXPERIMENTS, "all", "tables"),
        help="experiment to run; 'all' runs each exactly once, 'tables' regenerates the report",
    )
    parser.add_argument(
        "--smoke",
        action="store_true",
        help="run at smoke scale: structurally complete, statistically meaningless, writes nothing",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Parse arguments and dispatch. Returns a process exit code."""
    args = build_parser().parse_args(argv)
    scale = SMOKE if args.smoke else FULL

    if args.target == "tables":
        if args.smoke:
            print("tables has no smoke scale; it reads whatever is committed", file=sys.stderr)
            return 2
        render_tables()
        return 0

    names = tuple(EXPERIMENTS) if args.target == "all" else (args.target,)
    failures: list[str] = []
    for name in names:
        try:
            run_experiment(name, scale)
        except NotImplementedError as error:
            print(f"[{name}] {error}")
            failures.append(name)

    if failures:
        print(f"\nnot yet implemented: {', '.join(failures)}")
    if scale == FULL and not failures:
        print(f"\nresults in {RESULTS_DIR}")
    return 0


if __name__ == "__main__":  # pragma: no cover - exercised by the command line, not tests
    raise SystemExit(main())

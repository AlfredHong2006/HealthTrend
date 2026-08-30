"""Provenance, seed bookkeeping and the serialisation rules for committed results.

Three concerns live here, all of them about making a result mean something a month later.

**Seeds are allocated in disjoint blocks, not chosen.** :data:`SEED_BASES` gives every
experiment -- and every train/test split within an experiment -- a range that provably does
not overlap any other. This is the leakage guard: a tuner handed a series whose seed lies
outside the training range is looking at test data, and can say so rather than quietly
producing an optimistic number. Test ``EV7`` asserts the disjointness structurally, so a
future experiment cannot be added with a colliding block by accident.

**Every result file carries the configuration that produced it.** :class:`RunConfig` is
written into the ``_config`` key of each committed JSON file: the experiment, the scale,
the seed ranges, the grid, and the model parameters in force. Test ``EV10`` reads that
block back and fails if the committed results no longer match the current
:meth:`~app.core.types.ModelParams.default` -- so changing a prior loudly invalidates the
evidence rather than silently outdating it.

**Floats are rounded before they are committed, never before they are judged.** Six
significant digits is far more than any conclusion here rests on, and it keeps a
regenerated file from churning in its last bits. Every pass/fail decision is computed on
the unrounded values and stored as its own boolean; counts stay exact integers. No
timestamps are written: a result that differs only because it was produced on a different
day is a diff with no information in it.

Determinism is claimed for the same machine only. NumPy's PCG64 streams are reproducible
across platforms, but the order and rounding of floating-point reductions is not, so a
result regenerated on different hardware may differ in its last bits -- which is precisely
what the six-digit rounding absorbs.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from itertools import pairwise
from pathlib import Path
from typing import Any, Final

from app.core.types import ModelParams

RESULTS_DIR: Final = Path(__file__).parent / "results"
"""Where full-scale result files are written, and committed from."""

DOCS_EVALUATION_DIR: Final = Path(__file__).parents[2] / "docs" / "evaluation"
"""Where the generated tables and the narrative report live."""

JSON_SIGNIFICANT_DIGITS: Final = 6
"""Significant digits retained for floats in committed result files."""


@dataclass(frozen=True, slots=True)
class SeedRange:
    """A half-open block of seeds owned by one experiment or one split.

    Attributes:
        base: the first seed in the block.
        span: how many seeds the block reserves. Blocks are sized generously; an
            experiment that outgrows its block should be given a bigger one rather than
            allowed to spill into its neighbour.
    """

    base: int
    span: int

    @property
    def end(self) -> int:
        """One past the last seed in the block."""
        return self.base + self.span

    def __contains__(self, seed: int) -> bool:
        """Return whether ``seed`` belongs to this block."""
        return self.base <= seed < self.end

    def at(self, offset: int) -> int:
        """Return the seed ``offset`` places into the block.

        Raises:
            ValueError: if the offset would leave the block. Silently wrapping or
                spilling would break the disjointness this class exists to guarantee.
        """
        if not 0 <= offset < self.span:
            raise ValueError(
                f"seed offset {offset} leaves a block of span {self.span}; "
                f"enlarge the block rather than overrunning the next one"
            )
        return self.base + offset

    def to_dict(self) -> dict[str, int]:
        """Return a JSON-serialisable view."""
        return {"base": self.base, "span": self.span, "end": self.end}


SEED_BASES: Final[dict[str, SeedRange]] = {
    "e1": SeedRange(1_000_000, 50_000),
    "e2_daily": SeedRange(1_100_000, 50_000),
    "e2_irregular": SeedRange(1_200_000, 50_000),
    "e2_recheck": SeedRange(1_300_000, 50_000),
    "e34": SeedRange(2_000_000, 200_000),
    "e34_redraw": SeedRange(2_500_000, 200_000),
    "e5_train": SeedRange(3_000_000, 50_000),
    "e5_test": SeedRange(3_100_000, 50_000),
}
"""Disjoint seed blocks, one per experiment or split.

``e2_recheck`` exists so that a single marginal calibration miss can be re-examined on
genuinely fresh data without reusing anything, which is what the stop criterion in the M6
plan requires before any code is suspected.

``e34_redraw`` supplies replacement seeds when a long-span model-consistent draw wanders
to a non-positive weight, which :class:`~app.core.types.Observation` rightly refuses. The
replacement is drawn from a block no other experiment touches so the substitution stays
traceable and reproducible.
"""


def seeds_are_disjoint() -> bool:
    """Return whether every block in :data:`SEED_BASES` is disjoint from every other."""
    blocks = sorted(SEED_BASES.values(), key=lambda block: block.base)
    return all(earlier.end <= later.base for earlier, later in pairwise(blocks))


@dataclass(frozen=True, slots=True)
class RunConfig:
    """Provenance for one experiment run, written into the ``_config`` key.

    Attributes:
        experiment: the experiment identifier, matching the runner name.
        scale: ``"full"`` for a committed study, ``"smoke"`` for the fast structural run.
        seed_ranges: the blocks this experiment drew from.
        grid: the experiment's own configuration -- sizes, cells, regimes.
        params: the model parameters in force, from
            :meth:`~app.core.types.ModelParams.to_dict`.
    """

    experiment: str
    scale: str
    seed_ranges: dict[str, SeedRange]
    grid: dict[str, Any]
    params: dict[str, float]

    @classmethod
    def build(
        cls,
        experiment: str,
        scale: str,
        *,
        seed_keys: tuple[str, ...],
        grid: dict[str, Any],
        params: ModelParams | None = None,
    ) -> RunConfig:
        """Assemble a config from the named seed blocks and the current defaults."""
        resolved = ModelParams.default() if params is None else params
        return cls(
            experiment=experiment,
            scale=scale,
            seed_ranges={key: SEED_BASES[key] for key in seed_keys},
            grid=grid,
            params=resolved.to_dict(),
        )

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serialisable view."""
        return {
            "experiment": self.experiment,
            "scale": self.scale,
            "seed_ranges": {key: block.to_dict() for key, block in self.seed_ranges.items()},
            "grid": self.grid,
            "params": self.params,
        }


def round_float(value: float) -> float:
    """Round one float to :data:`JSON_SIGNIFICANT_DIGITS` significant digits.

    Raises:
        ValueError: on a non-finite value. Every quantity this study writes is a finite
            summary of finite data; an infinity or a NaN means something upstream failed
            silently, and writing it into a results file would hide that.
    """
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("a result value was not finite; refusing to commit it")
    return float(f"{number:.{JSON_SIGNIFICANT_DIGITS}g}")


def round_for_json(payload: object) -> object:
    """Recursively round every float in ``payload``, leaving ints and bools untouched.

    Applied once, immediately before serialisation. Anything that decides a pass, a stop
    criterion or a comparison must already have been computed on the unrounded values.
    """
    if isinstance(payload, bool):
        return payload
    if isinstance(payload, int):
        return payload
    if isinstance(payload, float):
        return round_float(payload)
    if isinstance(payload, dict):
        return {key: round_for_json(value) for key, value in payload.items()}
    if isinstance(payload, list | tuple):
        return [round_for_json(item) for item in payload]
    return payload


def to_json_text(payload: object) -> str:
    """Serialise ``payload`` in the repository's committed-artefact format.

    Two spaces of indent, keys sorted, one trailing newline -- the same shape the golden
    fixtures use, so a diff is reviewable rather than a reflow.
    """
    return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def write_results(experiment: str, config: RunConfig, results: object) -> Path:
    """Round, serialise and write one experiment's results. Returns the path written."""
    payload = {"_config": config.to_dict(), "results": results}
    path = RESULTS_DIR / f"{experiment}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(to_json_text(round_for_json(payload)), encoding="utf-8")
    return path


def read_results(experiment: str) -> dict[str, Any]:
    """Read one committed result file.

    Raises:
        FileNotFoundError: if the experiment has not been run at full scale.
    """
    path = RESULTS_DIR / f"{experiment}.json"
    if not path.exists():
        raise FileNotFoundError(
            f"{path} does not exist; run `python -m evaluation.run {experiment}` first"
        )
    loaded: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return loaded

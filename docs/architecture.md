# Architecture

Milestone 1 contains one layer: the pure numerical core. This document records the boundaries it will
be extended across, so later milestones add to the structure rather than negotiating it again.

## The dependency rule

```
  units  ·  time_axis  ·  types           no dependencies beyond numpy + stdlib
        |
        v
  model  ->  kalman  ->  filter  ->  forecast  ->  analyse
        |
        v
  [Milestone 2+]  ingestion  ->  services  ->  api        (not yet present)
        |
        v
  [Milestone 3+]  frontend                                (not yet present)
```

Dependencies point downward only. `app.core` never imports anything above it.

### What the core may not do

- import `fastapi`, `pydantic`, `pandas`, `requests`, `httpx`, `scipy`, `sklearn`, or any web or ORM
  framework
- read the clock (`datetime.now`, `time.time`), the environment, `sys.argv`, or the filesystem
- use randomness of any kind
- call `print`, `open`, `input`, `eval`, `exec`
- import from `app.api`, `app.ingestion`, `app.services` or any future sibling

This is enforced by [`backend/tests/core/test_architecture_purity.py`](../backend/tests/core/test_architecture_purity.py),
not by discipline. Imports are checked against an **allowlist** — `__future__`, `math`,
`dataclasses`, `datetime`, `typing`, `collections`, `numpy`, `app.core` — so a new dependency has to
be added there deliberately, which is the moment to ask whether the core should really have it. A
subprocess additionally imports `app.core` in a fresh interpreter and fails if any framework module
ends up loaded.

### Why this is worth enforcing

Three things follow from it, and all three are load-bearing:

1. **Determinism.** The same input always produces byte-identical output, which is what makes the
   golden regression test in `test_analyse_golden.py` mean anything. A core that consulted the clock
   would quietly turn that test into noise.
2. **Goal neutrality.** The core has no parameter through which a user's lose/maintain/gain goal
   could reach the estimator. That is a structural guarantee, not a code review promise
   (master plan §4).
3. **No health data in logs.** The core cannot print or log, so it cannot leak a measurement into a
   log line (master plan §42). Error messages name positions and field names, never values — see
   `UnsortedObservationsError` and test `F8`.

## Layout

```
backend/
  pyproject.toml          uv project; numpy is the only runtime dependency
  app/
    core/                 the pure layer
      units.py            kg/lb, kg/day <-> kg/week, prior interpretation
      time_axis.py        aware datetime <-> fractional days
      types.py            frozen value objects, errors, ModelParams
      model.py            F, Q, H, initialisation, covariance hygiene
      kalman.py           predict / update primitives
      filter.py           the pass over a series of observations
      forecast.py         propagation, forecast_at, forecast_path
      analyse.py          orchestration -> AnalysisResult
  testing/
    synthetic.py          deterministic seeded scenario generators
  tests/
    core/                 one module per core concern, plus purity + golden
    fixtures/             committed golden output
```

Reserved names, deliberately absent until they are needed: `app/api/`, `app/schemas/`,
`app/ingestion/`, `app/services/`, `app/evaluation/`, `frontend/`, `experiments/`, `sample_data/`,
`.github/workflows/`.

## Immutability and value objects

Every type in `types.py` is a frozen dataclass. Covariance matrices are copied into read-only NumPy
arrays on construction, so a value object handed to a caller cannot be mutated behind the
estimator's back. Types holding arrays set `eq=False`, because comparing arrays with `==` does not
produce a single boolean; compare the fields you care about, or `to_dict()`.

`Observation` validates on construction: timestamps must be timezone-aware, weights must be finite
and positive. This is why the runaway synthetic generator in test `F11` was caught rather than
silently producing nonsense.

`app/core/types.py` deliberately holds `ModelParams` as well as the estimates, so it depends only on
`units` and `time_axis` and the dependency diagram above stays literally true.

## Where later work attaches

| Later feature | Attachment point | Present today |
| --- | --- | --- |
| CSV / Apple Health ingestion | core consumes `Sequence[Observation]` of UTC instants in kg; parsing, unit conversion, sorting and de-duplication are ingestion's job | the contract |
| HTTP API | Pydantic schemas mirror `AnalysisResult`; `run_analysis` is already the service call | `AnalysisResult.to_dict()` |
| 7- and 90-day forecasts | `horizon_days` is already a parameter | test `P6` exercises 7/30/90 |
| "30 days from now" for a stale series | `origin` parameter on `forecast_at` / `forecast_path` | tests `P5`, ADR-0005 |
| Robust / adaptive `R` | `Observation.obs_variance` per-observation override | field, unused |
| Model inspector (§51) | `FilterStep` records prior, posterior, innovation, `S`, normalised innovation, gain | recorded, not surfaced |
| MLE parameter fitting | `FilterResult.loglik` | accumulated |
| RTS smoother (§23) | per-step priors and posteriors are the smoother's input | recorded |
| Contextual ML (§31) | ML models residuals against this baseline | `AnalysisResult` is the baseline |
| Baselines, calibration study | `testing/synthetic.py` generators, `normalized_innovation` | generators + diagnostics |

## Tooling

`uv` for environment and dependencies; `ruff` for lint and format; `mypy --strict` over `app` and
`testing`; `pytest` with `filterwarnings = ["error"]`, so any NumPy deprecation or invalid-value
warning fails the build.

Matrices in the core are named after the symbols they implement — `F`, `Q`, `P`, `H`, `K`. The
pep8-naming rules `N803`/`N806` are switched off for `app/core/**` and `tests/**` for exactly that
reason: lower-casing them would break the correspondence between `docs/mathematics.md` and the code,
which is the point of writing it this way.

No CI yet. `pyproject.toml` is arranged so that a workflow running the four commands in the README is
a later addition of about twenty lines.

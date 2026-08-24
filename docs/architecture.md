# Architecture

Milestone 1 was one layer: the pure numerical core. Milestone 2 added the HTTP boundary above it
without changing a line of it. Milestone 3 added a Next.js frontend above that, again without
changing a line of the backend — ADR-0008's decision was specifically *not* to add CORS, because
every Milestone 3 request still ran server-to-server. Milestone 4 (real-data manual entry) is the
first change to reach back into the backend: a browser now calls `POST /api/analyse` directly, so
`app/main.py` gained narrow, fail-closed CORS and its first environment-read (`app/config.py`),
recorded in [ADR-0009](decisions/ADR-0009-real-data-browser-boundary.md). Milestone 5 (CSV
weight-history import) adds a second endpoint, `POST /api/ingest/csv`, exactly at the seam this
document already reserved for it below — a parser in `app/ingestion/` producing `ObservationIn`,
reusing `normalise_observations` — and nothing about `/api/analyse`, the core, or CORS changes to
support it; see [ADR-0010](decisions/ADR-0010-csv-ingestion.md). This document records the
boundaries, so later milestones add to the structure rather than negotiating it again.

## The dependency rule

```
  units  ·  time_axis  ·  types           no dependencies beyond numpy + stdlib
        |
        v
  model  ->  kalman  ->  filter  ->  forecast  ->  analyse      app/core, the pure layer
        |
        v
  errors  ·  schemas  ·  demo             leaves above the core; no web framework
        |
        v
  ingestion  ->  services  ->  api  ->  main                    the HTTP boundary (backend/)

  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  a network boundary, not a
                                                                 same-process dependency
  schema.d.ts  ->  types  ->  client  ->  chart, analysis        frontend/, generated from
        |                                                        the committed openapi.json
        v
  components  ->  app/ (routes)                                  Next.js, server-rendered
```

The frontend is a **separate application**, not another layer of the same dependency graph: it talks
to the backend only over HTTP, through the committed OpenAPI contract
([ADR-0008](decisions/ADR-0008-frontend-contract-and-cors.md)), and could be replaced or removed
without the backend knowing. Within `frontend/`, `src/lib/api` (generated types, client, errors) sits
below `src/lib/chart` and `src/lib/analysis` (pure data shaping, no HTTP or React), which sit below
`src/components`, which sit below `src/app` (routes). Only `src/app` and `TrendChart` import
Next.js/React client-only APIs; everything below that is plain TypeScript, testable without either.

Dependencies point downward only. `app.core` never imports anything above it, and the direction
above it is `api -> services -> core`, with services reaching sideways into `ingestion` for
HTTP-supplied observations and `demo` for synthetic ones.

Three rules hold across the whole tree, and
[`backend/tests/test_layering.py`](../backend/tests/test_layering.py) enforces each by AST scan
rather than by review:

1. **No production module imports `testing`.** That package is test-support code, it is allowed
   randomness the application should not casually acquire, and shipping a package named `testing` in
   a deployment artefact is indefensible. It is also why `app/demo/` has its own generators
   (ADR-0007).
2. **Only `app.api` and `app/main.py` import a web framework.** Everything below stays callable from
   a script or a test with no FastAPI present, which is what keeps the numerical work testable
   without HTTP in the way.
3. **`app.demo` knows nothing about HTTP or the service layer.** A scenario is a list of core
   observations, so it can be generated and inspected on its own.

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
   could reach the estimator. That is a structural guarantee, not a code review promise.
3. **No health data in logs.** The core cannot print or log, so it cannot leak a measurement into a
   log line (docs/privacy.md). Error messages name positions and field names, never values — see
   `UnsortedObservationsError` and test `F8`.

## Layout

```
backend/
  pyproject.toml          uv project; numpy, fastapi, pydantic, uvicorn
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
    errors.py             domain errors raised above the core
    schemas/              pydantic wire contract
      analysis.py         request, response, the core -> wire adapters
      demo.py             catalogue and demo response
      errors.py           the one error envelope
      health.py           liveness
    demo/
      scenarios.py        the five product scenarios and their registry
    ingestion/
      observations.py     units, UTC, stable sort, keep-everything
      csv.py              CSV -> ObservationIn: header resolution, timestamp/unit
                          resolution, per-row validation (ADR-0010)
    services/
      clock.py            Clock protocol + SystemClock
      analysis.py         forecast-origin policy; the two service calls
      ingestion.py        parses a CSV upload, counts duplicates, builds the report
    api/
      deps.py             the injected clock
      errors.py           exception -> response, by explicit table
      logging.py          access log carrying counts only
      routes.py           /health, /api/analyse, /api/demo, /api/demo/{scenario}, /api/ingest/csv
    main.py               create_app()
  testing/
    synthetic.py          deterministic seeded generators, for the core tests only
  tests/
    core/                 one module per core concern, plus purity + golden
    api/                  the HTTP boundary, plus the golden HTTP response
    test_layering.py      the dependency rules above
    fixtures/             committed golden output
```

Reserved names, deliberately absent until they are needed: `app/evaluation/`, `experiments/`.

`sample_data/` now exists, at the repository root: synthetic CSV files a reviewer can feed to
`POST /api/ingest/csv` without supplying real measurements. It is the one place `.gitignore`
permits a committed `.csv` (docs/privacy.md).

`frontend/` is no longer reserved — see [below](#the-frontend) for its layout.

## What the HTTP layer is responsible for

The core is strict and narrow — kilograms only, aware instants only, non-decreasing order only, and
it raises rather than repairing anything. That is only tolerable because a layer takes responsibility
for meeting it. Splitting those responsibilities explicitly:

| Job | Where | Why not in the core |
| --- | --- | --- |
| kg/lb conversion | `ingestion` | the core accepts one unit so nothing downstream checks a tag (ADR-0001) |
| UTC normalisation, rejecting naive timestamps | `schemas` (`AwareDatetime`) + `Observation` | a naive datetime does not identify an instant, and the core will not guess |
| chronological sorting | `ingestion` | `run_filter` raises instead of reordering, so upstream bugs surface (ADR-0004) |
| keeping duplicates and same-instant readings | `ingestion` (by doing nothing) | `dt = 0` is exact; aggregation is a separate experiment (ADR-0004) |
| reading the clock | `services/clock.py` | the core must stay deterministic; the origin is a parameter (ADR-0005) |
| choosing the forecast origin | `services/analysis.py` | "30 days from when?" is a product question (ADR-0006) |
| turning exceptions into responses | `api/errors.py` | by explicit table, never from exception text (ADR-0006) |
| logging | `api/logging.py` | counts and route templates only; the core cannot log at all |

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
| Apple Health ingestion | a sibling parser in `app/ingestion/`, same shape as `csv.py`, reusing `normalise_observations` | CSV ingestion shipped in Milestone 5 at this exact seam ([ADR-0010](decisions/ADR-0010-csv-ingestion.md)) |
| trend classification, plateau, goals | a new response block plus a service; the estimator stays goal-neutral | `AnalysisResponse` |
| "30 days from now" for a stale series | `origin` parameter on `forecast_at` / `forecast_path` | tests `P5`, ADR-0005 |
| Robust / adaptive `R` | `Observation.obs_variance` per-observation override | field, unused |
| Model inspector (§51) | `FilterStep` records prior, posterior, innovation, `S`, normalised innovation, gain | recorded, not surfaced |
| MLE parameter fitting | `FilterResult.loglik` | accumulated |
| RTS smoother (§23) | per-step priors and posteriors are the smoother's input | recorded |
| Contextual ML (§31) | ML models residuals against this baseline | `AnalysisResult` is the baseline |
| Baselines, calibration study | `testing/synthetic.py` generators, `normalized_innovation` | generators + diagnostics |

Real-data upload from the frontend — a submit form calling `POST /api/analyse` directly from the
browser — is no longer future work; it shipped in Milestone 4. See [below](#the-frontend) for the
implemented shape and [ADR-0009](decisions/ADR-0009-real-data-browser-boundary.md) for the decisions
behind it.

## The frontend

```
frontend/
  package.json  package-lock.json  .nvmrc  .env.example
  next.config.ts  tsconfig.json  eslint.config.mjs  vitest.config.ts  vitest.setup.ts
  src/
    app/
      layout.tsx  page.tsx  globals.css  tokens.css
      demo/[scenario]/
        page.tsx        server component: fetch, then compose
        loading.tsx  error.tsx  not-found.tsx
      analyse/
        page.tsx        server component: static structure + privacy notice only
    components/
      Headline/  RateReadout/  ForecastCallout/  SyntheticBadge/  ScenarioNav/
      TrendChart/            'use client': pointer-driven tooltips
      MeasurementForm/       'use client': add/remove rows, client-side validation
      CsvImport/             'use client': read a CSV, show the parse report (Milestone 5)
      AnalysisWorkspace/     'use client': owns entry-mode, the direct-to-backend calls, the result
    lib/
      api/
        schema.d.ts          GENERATED from backend/openapi.json -- do not edit
        types.ts  client.ts  errors.ts   server-side: the demo path
        browserClient.ts     browser-side: manual entry (ADR-0009) and CSV import (ADR-0010)
      chart/
        series.ts            pure: an analysis response -> plottable arrays
        hover.ts  format.ts
      analysis.ts
      time.ts                 datetime-local -> UTC ISO; browser IANA-zone detection for CSV import
      privacy/
        __tests__/no-persistence.test.ts   static guard: no browser storage in src/
```

Two fetching models now coexist, deliberately kept apart rather than unified. The demo path is
unchanged since Milestone 3: every fetch happens inside a Next.js **server component**
(`src/app/demo/[scenario]/page.tsx`), using plain `fetch` with `cache: "no-store"` — demo data is
generated relative to the current instant (ADR-0007), so the same URL legitimately returns different
data on every request. There is no client-side data fetching, no state library and no caching layer
on that path: switching scenarios is a URL change (`/demo/{scenario}`), which the router handles.

The manual-entry path (`/analyse`, Milestone 4) is the one deliberate exception: `AnalysisWorkspace`
is a client component that calls `submitAnalysis` (`lib/api/browserClient.ts`) directly from the
browser to `POST /api/analyse`, bypassing the Next.js server entirely. `browserClient.ts` is a
separate module from `client.ts` rather than an addition to it — the two resolve their base URL from
different environment variables (`NEXT_PUBLIC_HEALTHTREND_API_URL` vs `HEALTHTREND_API_URL`), and
merging them risks the public one silently reaching the private one's call sites. See
[ADR-0009](decisions/ADR-0009-real-data-browser-boundary.md) for why this path talks to FastAPI
directly instead of proxying through the Next.js server, and what that requires of the backend (CORS).

CSV import (`CsvImport`, Milestone 5) extends this same path rather than adding a third one: it
calls `ingestCsv` (also in `browserClient.ts`) directly from the browser to `POST /api/ingest/csv`,
then hands the response's `accepted` list to the identical `submitAnalysis` call `MeasurementForm`
already makes. `AnalysisWorkspace` toggles between `MeasurementForm` and `CsvImport` as two ways of
producing the same `ObservationIn[]`; neither `AnalysisResult` nor `/api/analyse` knows or needs to
know which one a given submission came from. See
[ADR-0010](decisions/ADR-0010-csv-ingestion.md).

`TrendChart`, `MeasurementForm`, `CsvImport` and `AnalysisWorkspace` are the only components that
need the browser and the only places `'use client'` appears outside the files Next.js itself
requires it for (`error.tsx`).

`src/lib/api/schema.d.ts` is generated by `openapi-typescript` from the **committed**
`backend/openapi.json` (`npm run gen:api`), not from a running server, so the frontend typechecks on
a cold clone with no Python installed. See
[ADR-0008](decisions/ADR-0008-frontend-contract-and-cors.md) for why generated types were chosen over
a handwritten contract, and how CI catches drift between the two files.

## Tooling

`uv` for environment and dependencies; `ruff` for lint and format; `mypy --strict` over `app` and
`testing`; `pytest` with `filterwarnings = ["error"]`, so any NumPy deprecation or invalid-value
warning fails the build.

Matrices in the core are named after the symbols they implement — `F`, `Q`, `P`, `H`, `K`. The
pep8-naming rules `N803`/`N806` are switched off for `app/core/**` and `tests/**` for exactly that
reason: lower-casing them would break the correspondence between `docs/mathematics.md` and the code,
which is the point of writing it this way.

CI is [`.github/workflows/backend.yml`](../.github/workflows/backend.yml): the four commands from the
README, in order, on every push and pull request. `uv sync --locked` is used rather than `uv sync`, so
a lockfile that has drifted from `pyproject.toml` fails the build instead of quietly resolving
something other than what was tested locally.

The test client needs `httpx2` rather than `httpx`: recent Starlette emits a deprecation warning when
`TestClient` is used with `httpx`, and `filterwarnings = ["error"]` turns that into a failure. Fixing
the dependency was preferred over adding a warning exemption, because the "any warning fails the
build" rule is worth more than the convenience.

The frontend has its own workflow, [`.github/workflows/frontend.yml`](../.github/workflows/frontend.yml),
deliberately separate from `backend.yml` rather than one combined pipeline: the two run
independently, so a frontend failure never blocks the backend job from reporting and vice versa. It
runs `npm ci`, regenerates `schema.d.ts` and diffs it against the committed file (contract drift),
`eslint`, `tsc --noEmit`, `vitest run`, and `next build` — the same commands documented in the README,
in the same order.

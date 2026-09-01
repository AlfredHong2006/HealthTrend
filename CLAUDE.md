# CLAUDE.md

Permanent context for working in this repository. Read this before editing anything.

## What HealthTrend is

HealthTrend estimates the **underlying** weight trajectory behind noisy scale readings, states how
confident it is, and forecasts where that trajectory is heading.

The engine is a **local linear trend state-space model** — state is latent weight `w` and its
velocity `v` — estimated with a **Kalman filter** over real elapsed time (not step indices), with
analytic Gaussian forecasts at fixed 7 / 30 / 90-day horizons. Uncertainty is propagated through the
covariance, not decorated afterwards. Model parameters are documented priors, never fitted values.

It is an estimation product, not a weight logger. Canonical product definition:
[docs/product/V2_PRODUCT.md](docs/product/V2_PRODUCT.md). Approved V2 design direction:
[docs/design/V2_DESIGN.md](docs/design/V2_DESIGN.md).

## Current stage

- **V2 is implemented and deployed** — the Vercel-hosted frontend linked from the README, backed by
  the FastAPI service. V2 is the public, recruiter-facing version of the product. Its routes are
  `/v2/[scenario]` for the synthetic scenarios (`/v2/gradual-loss` is the primary entry point),
  `/v2/analyse` for manual and CSV analysis of the user's own data, `/v2/method`, and `/v2/about`.
- **The accepted Analysis composition is settled** — one centred column, read top to bottom:
  hero → chart → analysis summary and supporting context → statistics → Inspect analysis. It is not
  a split pane and has no persistent desktop rail. Do not reopen this.
- **Real-data ingestion reuses the existing backend, API and ingestion logic** — `/v2/analyse` calls
  the same `POST /api/analyse` and `POST /api/ingest/csv` V1 already used, through the same
  `MeasurementForm` and `CsvImport` components, and hands the unchanged `AnalysisResponse` to the
  same V2 presentation a synthetic scenario renders through. The ingestion path was not forked and
  must not be.
- **V1 is still present and still served** at `/demo/[scenario]` and `/analyse`, against the same
  API. V2 was added beside it, not on top of it.
- **Milestone 6 evaluation is complete and committed** — `docs/evaluation/` (report and generated
  results), with the studies themselves in `backend/evaluation/`, which the application cannot
  import. Its findings bound what the product may claim.
- **Nothing here is globally finished.** V2 is accepted and shipped; the project continues.
- **The current priority is CV and applications, not further V2 polish.** Treat the shipped V2 as
  accepted work. Do not open speculative redesign, refactoring or polish tasks against it.

## Structure

```
backend/   FastAPI + NumPy, uv-managed, Python 3.11
  app/core/      pure layer: units · time_axis · types · model · kalman · filter · forecast · analyse
  app/schemas/   Pydantic wire contract       app/demo/      synthetic scenarios
  app/ingestion/ observations + CSV parsing   app/services/  clock, forecast-origin policy
  app/api/       routes, error table, metadata-only access log      app/main.py  create_app()
  testing/       deterministic generators, test-support only (never imported by app/)
  evaluation/    the M6 studies; importable by tests only, never by app/
  tests/         core/ · api/ · evaluation/ · test_layering.py · fixtures/ (committed golden output)
  openapi.json   COMMITTED contract, generated from the app
frontend/  Next.js 16 (App Router) · React 19 · TypeScript · CSS Modules · visx · Vitest
  src/app/v2/      SHIPPED V2: [scenario] · analyse · method · about · v2-tokens.css (own shell)
  src/app/         V1, still served: /demo/[scenario] (server components) · /analyse · tokens.css
  src/components/v2/  V2Header · V2Hero · V2Canvas · V2Summary · V2StatsBand · V2Inspector ·
                   V2Workspace · V2AnalyseWorkspace · V2AnalysisShell · V2Method · V2About
  src/components/  V1: Headline · RateReadout · ForecastCallout · TrendChart · MeasurementForm ·
                   CsvImport · AnalysisWorkspace · ScenarioNav · SyntheticBadge
  src/lib/         api/ (schema.d.ts GENERATED · client server-side · browserClient) ·
                   chart/ (pure shaping, no React or HTTP) · v2/ (pure V2 shaping and copy) ·
                   privacy/ (no-persistence guard)
docs/      architecture.md · mathematics.md · privacy.md · decisions/ADR-0001..0011 ·
           evaluation/ (report.md · results.md) · product/V2_PRODUCT.md ·
           design/V2_DESIGN.md · design/IMPLEMENTATION_NOTES.md
sample_data/  the only place a committed .csv is permitted
```

`private/` and `.claude/` are gitignored and are not project content.

## Architectural invariants

These are enforced by tests, not by convention. Breaking one fails CI.

1. **Dependency direction is `api → services → core`.** Nothing below the API layer imports upward.
   The frontend is a separate application reached only over HTTP.
2. **`app/core` is pure.** No web framework, no clock, no randomness, no filesystem, no environment,
   no `print`/`open`/`eval`. Imports are checked against an allowlist
   (`tests/core/test_architecture_purity.py`); a new core dependency is a deliberate decision.
3. **Determinism.** The same input produces byte-identical output. Committed golden fixtures depend
   on this — a core that read the clock would turn them into noise.
4. **Goal neutrality is structural.** The estimator has no parameter through which a user's
   lose/maintain/gain goal could reach it. Goals live above the core, never inside it.
5. **Only `app.api` and `app/main.py` may import a web framework.** No production module imports
   `testing`. `app.demo` knows nothing about HTTP.
6. **Any warning fails the build** (`filterwarnings = ["error"]`).

## The mathematical core is not casually modifiable

`app/core/**` and the priors in `ModelParams` determine every user-visible number. Do not change
equations, parameters, initialisation, covariance handling or forecast propagation unless that is
explicitly the task. Every equation and its implementing symbol is indexed in
[docs/mathematics.md](docs/mathematics.md), together with the stated assumptions and limitations; a
change contradicting that document requires the document to change too, and an ADR.

The golden fixtures (`backend/tests/fixtures/`) exist to make an accidental mathematical change loud.
If a golden test fails, the correct first assumption is that the change was wrong — not that the
fixture is stale. Regeneration scripts exist, but regenerating is a reviewed decision, never a way to
make a test pass.

Recorded-but-unsurfaced diagnostics (`FilterStep`: innovation, innovation variance, normalised
innovation, Kalman gain, log-likelihood contribution; `FilterResult.loglik`) are deliberate
attachment points for later work — computed today, published nowhere.

## Privacy and statelessness

Full rules in [docs/privacy.md](docs/privacy.md). The operative constraints:

- **Nothing is persisted.** No accounts, database, session, cache or telemetry. A static test fails
  the build if `localStorage`, `sessionStorage`, IndexedDB or `document.cookie` appears anywhere
  under `frontend/src`.
- **No measurement may reach a log.** The access log carries counts and route *templates* only. Error
  responses come from an explicit table, never exception text; unexpected exceptions log a class name
  and nothing else.
- **Only synthetic, explicitly-labelled data is committed.** `.gitignore` blocks real exports and any
  `.csv` outside `sample_data/`.
- **Not a medical device.** Language stays hedged — *estimated*, *likely*, *consistent with*. Never
  *caused by*, *definitely*, *medically healthy*.
- **Claim only what is implemented and measured.** The frontend may do *transparent presentation
  arithmetic* — unit formatting and conversion, time-range slicing, distance to a user-supplied goal,
  and comparing the backend-computed current rate against a user-supplied target rate. It must not
  manufacture statistical inference: no classifications, probabilities, thresholds or medical
  conclusions. "High confidence", "plateau", "losing steadily" need a defined backend result that
  does not exist. An unimplemented capability is **omitted entirely** — never rendered as "unknown /
  not enough evidence", which would tell the user an analysis ran.

## The generated contract

`backend/openapi.json` is committed. `frontend/src/lib/api/schema.d.ts` is generated from it by
`npm run gen:api` and **must never be hand-edited**. CI regenerates both and fails on any diff, so:

- change a Pydantic model or route → `uv run python -m tests.api.regenerate_openapi`
- then, from `frontend/` → `npm run gen:api`

A backend schema change that skips either step breaks the build, which is the intent.

## Commands

From `backend/` (requires [uv](https://docs.astral.sh/uv/)):

```bash
uv sync --locked                 # provision; fails on a drifted lockfile
uv run ruff check .              # lint
uv run ruff format --check .     # format check
uv run mypy                      # strict type check (app, testing, evaluation)
uv run pytest -q                 # tests
uv run python -m tests.api.regenerate_openapi        # after any schema/route change
HEALTHTREND_ALLOWED_ORIGINS=http://localhost:3000 uv run uvicorn app.main:app --no-access-log
```

From `frontend/` (Node version pinned in `.nvmrc`):

```bash
npm ci                           # install from the lockfile
npm run gen:api                  # regenerate schema.d.ts from backend/openapi.json
npm run lint                     # ESLint
npm run typecheck                # next typegen && tsc --noEmit
npm run test                     # Vitest + Testing Library + axe
npm run build                    # production build
npm run dev                      # http://localhost:3000
```

CI runs exactly these, in this order, in two independent workflows.

## Inspect before editing

This codebase encodes its reasoning in the files themselves — module docstrings, ADRs, and the
reference documents in `docs/`. Read the module you are about to change, and the ADR it cites, before
changing it. Most apparent oddities here are deliberate and documented; assume a decision exists
until you have looked for it.

## Git — absolute rule

**Alfred performs all Git writes. Agents perform none.**

Never run: `git add`, `git commit`, `git push`, `git merge`, `git rebase`, `git reset`,
`git restore`, `git checkout`, `git switch`, `git stash`, `git clean`, `git revert`, `git tag`, any
history rewriting (`filter-branch`, `commit --amend`, `push --force`), or any remote modification
(`git remote add/remove/set-url`). Do not stage, do not commit "to be safe", do not offer to.

Read-only inspection is allowed and encouraged: `git status`, `git log`, `git diff`, `git show`,
`git blame`, `git branch --list`.

Leave changes in the working tree and report them. Alfred reviews and commits.

The coding-agent workflow, validation expectations and reporting format are in
[AGENTS.md](AGENTS.md).

# HealthTrend

Body weight is noisy. A scale reading moves with hydration, food still being digested, sodium,
glycogen, measurement time and ordinary physiology — so the difference between yesterday's number and
today's number is usually not a change in body weight at all.

HealthTrend estimates the **underlying** weight trajectory behind those readings, quantifies how
uncertain that estimate is, and forecasts where the trajectory is probably heading.

---

## Status: Milestone 5 — CSV weight-history import

There is a backend and a web frontend. Measurements can be entered manually or imported from a
CSV file; there are no accounts and nothing is stored.

**Implemented**

- Local-linear-trend state-space model over irregularly-timed weight measurements
- Kalman filtering with Joseph-form covariance updates
- Latent weight estimate with a 95% interval
- Trend velocity (kg/day, reported as kg/week)
- Analytic 7-, 30- and 90-day probabilistic forecasts, with a band that widens with horizon
- A JSON API: submit weigh-ins in kg or lb, in any order, from any timezone
- Five synthetic demo scenarios, so the product can be tried with no data of your own
- Privacy-safe error and log behaviour, enforced by sentinel-value tests
- A Next.js frontend: pick a scenario, see the estimated weight, weekly rate, forecast and a
  graph joining history to forecast, with explicit uncertainty throughout
- TypeScript types generated from the backend's own OpenAPI contract, checked for drift in CI
- Deterministic test suite covering the mathematics, the HTTP boundary and the frontend
- Manual measurement entry and CSV weight-history import, both feeding the same analysis endpoint
  (see [ADR-0010](docs/decisions/ADR-0010-csv-ingestion.md))

**Not implemented yet:**

Apple Health parsing, trend classification, plateau detection, change detection, goal projection,
robust outlier handling, RTS smoothing, baseline comparison, calibration study, contextual machine
learning, accounts, deployment.

No accuracy or robustness claims are made at this stage. Milestones 2 to 5 changed no mathematics —
they put the existing estimator behind HTTP, then behind a browser, then behind manual entry and
CSV import. The model parameters are documented priors, not values fitted to data — see
[docs/mathematics.md](docs/mathematics.md).

---

## Running it

Requires [uv](https://docs.astral.sh/uv/). From `backend/`:

```
uv sync                        # provision Python 3.11 and dependencies
uv run pytest -q               # full test suite
uv run ruff check .            # lint
uv run ruff format --check .   # formatting
uv run mypy app                # strict type checking
```

Then start the server. `HEALTHTREND_ALLOWED_ORIGINS` is the CORS allow-list for the browser-side
real-data pages (`/analyse`); it is empty by default, so nothing is permitted until you name the
frontend's origin. `--no-access-log` disables uvicorn's built-in access log as privacy hardening:
that log records request metadata — method, raw path, query string — never JSON bodies, but raw
paths are caller-controlled strings, and the application writes its own metadata-only access log
instead ([docs/privacy.md](docs/privacy.md)).

```
# bash / zsh
HEALTHTREND_ALLOWED_ORIGINS=http://localhost:3000 uv run uvicorn app.main:app --no-access-log

# PowerShell
$env:HEALTHTREND_ALLOWED_ORIGINS = "http://localhost:3000"; uv run uvicorn app.main:app --no-access-log
```

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | liveness |
| `POST /api/analyse` | analyse submitted weigh-ins |
| `POST /api/ingest/csv` | parse an uploaded CSV into observations for `/api/analyse` |
| `GET /api/demo` | list the synthetic demo scenarios |
| `GET /api/demo/{scenario}` | analyse one of them |
| `GET /docs`, `GET /openapi.json` | interactive docs and the machine-readable contract |

Try it without any data of your own:

```
curl localhost:8000/api/demo
curl localhost:8000/api/demo/gradual-loss
```

Or with your own:

```
curl -X POST localhost:8000/api/analyse -H 'content-type: application/json' -d '{
  "observations": [
    {"timestamp": "2026-08-01T07:30:00+01:00", "weight": 72.4, "unit": "kg"},
    {"timestamp": "2026-08-08T07:20:00+01:00", "weight": 71.9, "unit": "kg"}
  ]
}'
```

Horizons are fixed at 7, 30 and 90 days. By default they are measured from **now**, so a stale series
carries the extra elapsed uncertainty; the response publishes `origin_timestamp`,
`last_observation_timestamp` and `lead_days` so a client can say which it means. Pass
`"forecast_from": "last_observation"` for the series-relative view.

### Frontend

Requires Node (version pinned in [frontend/.nvmrc](frontend/.nvmrc)). From `frontend/`, with the
backend already running:

```
npm ci                         # install from the committed lockfile
npm run gen:api                # regenerate TypeScript types from backend/openapi.json
npm run typecheck              # strict type checking
npm run lint                   # ESLint
npm run test                   # Vitest + Testing Library + axe
npm run build                  # production build
npm run dev                    # http://localhost:3000
```

Copy [frontend/.env.example](frontend/.env.example) to `.env.local` to point at a backend that
is not on `localhost:8000`. Two variables exist because two request paths exist:

- The demo pages (`/demo/{scenario}`) fetch `GET /api/demo` and `GET /api/demo/{scenario}` from a
  Next.js server component using `HEALTHTREND_API_URL`, which never reaches the browser. On that
  path there is no client-side data fetching, state library or caching layer: switching scenarios is
  a URL change, handled by the router.
- The `/analyse` page is the real-data path: it calls `POST /api/analyse` (and, for CSV import,
  `POST /api/ingest/csv`) directly from the browser using `NEXT_PUBLIC_HEALTHTREND_API_URL`, which
  is why the backend needs that origin in `HEALTHTREND_ALLOWED_ORIGINS` (see above).

Opening `/` redirects to `/demo/gradual-loss`.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/mathematics.md](docs/mathematics.md) | Every equation, and the code symbol that implements it |
| [docs/architecture.md](docs/architecture.md) | Layer boundaries and the dependency rules |
| [docs/privacy.md](docs/privacy.md) | What must never be committed or logged |
| [docs/decisions/](docs/decisions/) | Architecture decision records (ADR-0001 to ADR-0010) |

## Privacy

Real health data never enters this repository. Only synthetic, explicitly-labelled data is committed.
See [docs/privacy.md](docs/privacy.md).

## Not a medical device

HealthTrend estimates and forecasts a measurement trend. It does not diagnose, treat or prescribe.

# HealthTrend

Body weight is noisy. A scale reading moves with hydration, food still being digested, sodium,
glycogen, measurement time and ordinary physiology — so the difference between yesterday's number and
today's number is usually not a change in body weight at all.

HealthTrend estimates the **underlying** weight trajectory behind those readings, quantifies how
uncertain that estimate is, and forecasts where the trajectory is probably heading.

---

## Status: Milestone 1 in progress

This repository currently contains **only the numerical core and its test suite**. There is no web
application yet.

**Implemented**

- Local-linear-trend state-space model over irregularly-timed weight measurements
- Kalman filtering with Joseph-form covariance updates
- Latent weight estimate with a 95% interval
- Trend velocity (kg/day, reported as kg/week)
- Analytic 30-day probabilistic forecast with an uncertainty band that widens with horizon
- Deterministic test suite covering the mathematics

**Not implemented yet:**

HTTP API, web frontend, CSV ingestion, Apple Health parsing, trend classification, plateau detection,
change detection, goal projection, robust outlier handling, RTS smoothing, baseline comparison,
calibration study, contextual machine learning, accounts.

No accuracy or robustness claims are made at this stage. The model parameters are documented priors,
not values fitted to data — see [docs/mathematics.md](docs/mathematics.md).

---

## Running the core

Requires [uv](https://docs.astral.sh/uv/). From `backend/`:

```
uv sync                        # provision Python 3.11 + numpy + dev tools
uv run pytest -q               # full test suite
uv run ruff check .            # lint
uv run ruff format --check .   # formatting
uv run mypy app                # strict type checking
```

## Documentation

| Document | Contents |
| --- | --- |
| [docs/mathematics.md](docs/mathematics.md) | Every equation, and the code symbol that implements it |
| [docs/architecture.md](docs/architecture.md) | Layer boundaries and the dependency rule |
| [docs/privacy.md](docs/privacy.md) | What must never be committed or logged |
| [docs/decisions/](docs/decisions/) | Architecture decision records (ADR-0001 to ADR-0005) |

The frozen product specification (the master plan) is not in this repository yet — drop it at
`docs/MASTER_PLAN.md`. Section references throughout the docs and code comments point at it.

## Privacy

Real health data never enters this repository. Only synthetic, explicitly-labelled data is committed.
See [docs/privacy.md](docs/privacy.md).

## Not a medical device

HealthTrend estimates and forecasts a measurement trend. It does not diagnose, treat or prescribe.

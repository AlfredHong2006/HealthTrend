# Privacy

HealthTrend handles body-weight measurements. Those are health data, and the default assumption is
that they never leave the machine they were measured on and never enter this repository.

Master plan §42 and §79 are the governing rules. This document is the operational form of them.

## Never committed

`.gitignore` blocks these from the first commit onward, before any data file could exist:

| Pattern | Why |
| --- | --- |
| `private/`, `real_data/`, `apple_health_export/` | conventional locations for real exports |
| `*.xml` | Apple Health exports are XML |
| `export*.zip`, `*.zip` | the Apple Health export is a zip |
| `*.csv` except under `sample_data/` | any CSV is assumed to be real measurements unless it is explicitly synthetic |
| `.env`, `.env.*` | credentials |

Real Apple Health exports belong outside the repository tree, or under `private/`.

Verify before any commit that no file matching these patterns is staged. All Git operations in this
project are performed by the developer, never by tooling.

## Only synthetic data is committed

Every committed dataset is generated, not measured. `testing/synthetic.py` enforces this at the type
level: `SyntheticSeries.__post_init__` raises unless the scenario label contains the word
"synthetic", so a generated series cannot be mistaken for real measurements. The committed golden
fixture carries its generator, seed and scenario parameters in a `_scenario` block, and test
`A2` asserts the label says synthetic.

## Health data never reaches a log

The numerical core cannot log. `print`, `open` and friends are forbidden in `app/core` and the ban is
enforced by `tests/core/test_architecture_purity.py`. There is no logging framework in the core at
all.

Error messages name positions and field names, never values. For example
`UnsortedObservationsError` reports "the observation at position 2 precedes the one at position 1" —
no weight, no timestamp. Test `F8` asserts that none of the input weights and no year appears in the
message, because an exception string is exactly the kind of thing that ends up in a log aggregator.

When the API layer arrives, the same rule applies to request logging: log that an analysis ran and
how many observations it covered, never the observations.

## No storage, no accounts

Milestone 1 stores nothing — it is a library that transforms a list of measurements into a result
object. There is no database, no session, no cache, no telemetry.

When the public web version arrives (master plan §42): synthetic demo data, user upload, analysis in
the request, no permanent health-data storage by default. Account-based tracking is a separate later
phase that needs its own storage and privacy design first.

## Not a medical device

HealthTrend estimates and forecasts a measurement trend. It does not diagnose, treat, prescribe or
explain physiology (master plan §79).

The language in code, docs and UI stays hedged for a reason: *estimated*, *likely*, *consistent with*,
*association*, *uncertainty*. Avoid *caused by*, *definitely*, *medically healthy*. The core supports
this by reporting distributions rather than point claims, and by being willing to produce an interval
so wide it says nothing — which is the correct output from one measurement, not a failure.

## Claims

Only claim what is implemented and measured (master plan §71). As of Milestone 1:

- the model parameters are documented priors, not values fitted to data
- calibration has been demonstrated only on data drawn from the model itself
- there is no robustness to outliers, and the sensitivity is measured and recorded
- no real health data has been used for any evaluation

Do not describe the system as validated, robust, or accurate until there are experiments that say so.

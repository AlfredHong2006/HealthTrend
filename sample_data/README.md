# Sample data

Synthetic data only. Nothing here was measured from a person — see
[docs/privacy.md](../docs/privacy.md) for the rule and the `.gitignore` patterns that enforce it.

## `example.csv`

A generated 63-day weight history, so `POST /api/ingest/csv` and the browser's CSV import on
`/analyse` can be tried without supplying real measurements.

| Property | Value |
| --- | --- |
| Rows | 48 weigh-ins across 63 days, with gaps |
| Underlying trend | 82.0 kg falling at 0.35 kg/week |
| Measurement noise | Gaussian, SD 0.42 kg |
| Timestamps | `Europe/London` local time; every fifth row is deliberately date-only |
| Units | `kg`, declared per row in a `unit` column |

The date-only rows exercise the documented convention that a date with no time is read as 12:00 in
the assumed timezone (ADR-0010); the rest carry an explicit UTC offset and so do not depend on it.
The file parses with zero row issues.

Import it with the timezone box set to `Europe/London` — or leave it at any other zone, since only
the date-only rows are affected.

The parser also accepts `date`/`datetime` as the timestamp column and `weight_kg` / `weight_lb`
(or `weight (kg)` / `weight (lb)`) instead of a separate `unit` column. This file uses one
combination; it is an example, not the specification.

# ADR-0004 — Multiple observations on the same day

**Status:** accepted, Milestone 1. Confirmed by the developer before implementation.

## Context

Real weigh-in data contains clusters: someone steps on the scale, does not like the number, steps on
again. Apple Health exports contain exact duplicates and same-minute repeats. The product rule is that
data must not be arbitrarily discarded, and that whatever rule is chosen must be documented and
experimentally tested.

## Decision

**Keep every observation.** No aggregation, no de-duplication, no preferred-time selection inside the
core. Each reading is absorbed by its own Kalman update.

Simultaneity needs no special case: `Δt = 0` gives `F = I` and `Q = 0`, so two readings at the same
instant reduce to two consecutive updates against the same prior. That is exactly correct, and
because sequential Gaussian updates commute, the order of same-instant readings does not affect the
result (test `F7`).

De-duplication and any daily aggregation belong to the ingestion layer, which knows the provenance of
the data. The core does not sort either — unsorted input raises `UnsortedObservationsError` rather
than being silently reordered, so an upstream bug surfaces instead of hiding (test `F8`).

## Alternatives considered

**Daily median before filtering.** Fewer, cleaner points, and it neatly sidesteps the correlation
problem below. Rejected for Milestone 1 on two grounds: it discards information the filter can
legitimately use, and it pushes an ingestion policy into the mathematical milestone, where it would
be untestable against the alternative. It remains the leading candidate for the Week 2 experiment.

**Preferred morning measurement.** Attractive physiologically — morning readings are the least
confounded by food and hydration. Rejected for now because it needs a defensible definition of
"morning" in the user's local timezone, and the core deliberately knows nothing about local time.
Better handled in ingestion once timezone metadata is being parsed.

**Collapsing exact duplicates only.** Rejected as a half-measure that solves the least interesting
case while leaving near-duplicates untouched.

## Known approximation

This is the cost, stated plainly: three weigh-ins minutes apart are strongly correlated in reality —
same hydration, same gut contents, same clothing — but the model treats them as three independent
draws with variance `R`. It therefore shrinks `P_ww` by roughly a factor of `√3` more than the
information really justifies, and the reported interval is correspondingly too narrow after a
cluster.

Two hooks already exist for fixing this without redesign:

- `Observation.obs_variance` overrides `R` per observation, so clustered readings can be inflated
  toward an effective independent-sample variance. Test `test_a_per_observation_variance_is_honoured`
  confirms the override reaches the filter.
- The Week 2 experiment can compare keep-all against daily median on forecast error and interval
  coverage, and decide on evidence.

## Consequences

Good: nothing is discarded; simultaneity is handled exactly rather than by a rule; the alternative
stays cheap to test later because the boundary is in ingestion, not in the estimator.

Cost: intervals are too narrow immediately after a cluster of readings, by an amount that has not
been quantified. Do not claim calibrated coverage on clustered real data until the Week 2 experiment
has run.

Related: [ADR-0002](ADR-0002-process-noise-and-irregular-dt.md)

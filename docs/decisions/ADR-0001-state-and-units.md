# ADR-0001 — State representation and canonical units

**Status:** accepted, Milestone 1

## Context

The estimator needs a hidden state, and everything above it needs to agree on units. Weight arrives
in kg or lb, timestamps arrive in any timezone or none, weigh-ins happen at arbitrary instants, and
users think in kg/week while the mathematics wants kg/day.

## Decision

The hidden state is two-dimensional:

```
x = [w, v]     w = latent weight (kg), v = rate of change (kg/day)
```

Canonical internal units: **kilograms**, **fractional days**, **kg/day**. Conversions to anything
else happen in `app/core/units.py` and nowhere else.

Consequences of that choice, each enforced:

- The core accepts kg only. `lb_to_kg` exists as a boundary helper for the future ingestion layer.
- The core accepts timezone-aware datetimes only. `require_utc_aware` rejects naive values rather
  than guessing a timezone; normalising them is ingestion's job.
- Time is **elapsed time in days**, never a step index. `TimeAxis.elapsed_days` subtracts datetimes
  directly, so results are exactly epoch-independent.
- Velocity is stored in kg/day and converted to kg/week only for display, via
  `per_day_to_per_week`.

## Alternatives considered

**Three-state model with acceleration** — `[w, v, a]`. Rejected for Milestone 1: it adds a parameter
and a mode of failure (acceleration is barely identifiable from noisy weekly-scale data) before the
two-state version has been validated at all. The 2×2 code generalises if the evidence ever justifies
it.

**Weight in whatever unit arrived, with a unit tag** — rejected. Every downstream computation would
have to check the tag, and one missed check is a silent 2.2× error.

**Integer time indices with a nominal daily step** — rejected outright. It is the assumption that
makes irregular weigh-ins wrong, and irregular weigh-ins are the normal case. See ADR-0002.

## Consequences

Good: no unit ambiguity anywhere inside the core; irregular timestamps work by construction; the
displayed rate is a presentation concern rather than a modelling one.

Cost: callers must convert before entering the core, and naive datetimes fail loudly. Both are
intended.

Related: [ADR-0002](ADR-0002-process-noise-and-irregular-dt.md),
[ADR-0003](ADR-0003-initialization.md)

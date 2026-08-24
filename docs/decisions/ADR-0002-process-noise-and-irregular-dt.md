# ADR-0002 — Process noise, and why irregular intervals are exact rather than approximated

**Status:** accepted, Milestone 1. Confirmed by the developer before implementation.

## Context

People do not weigh themselves on a schedule. A realistic series has two readings on one morning,
then nothing for three weeks. The model must handle intervals of 0 days, 0.25 days and 30 days in the
same series without any of them being a special case.

Two candidate forms for the process-noise covariance `Q(Δt)`.

## Decision

Use the **continuous white-noise-acceleration** (integrated Wiener) form, with a single parameter
`σ_a`:

```
Q(Δt) = σ_a² · [[Δt³/3, Δt²/2],
                [Δt²/2,    Δt ]]
```

Velocity is a Wiener process; weight is its integral.

## Why, specifically

It is the integral of the continuous-time noise through the dynamics,
`Q(Δt) = ∫₀^Δt F(s) Q_c F(s)' ds` with `Q_c = diag(0, σ_a²)`, and every covariance generated that
way satisfies the time-splitting identity

```
F(b) Q(a) F(b)' + Q(b) == Q(a + b)
```

This form is the minimal one-parameter member of that family (the level-jitter variant below is
another member and also satisfies the identity); a diagonal random walk is not a member and fails it.

Expanding the (1,1) entry gives `a³/3 + a²b + ab² + b³/3 = (a+b)³/3`; the off-diagonal gives
`a²/2 + ab + b²/2 = (a+b)²/2`; the (2,2) entry gives `a + b`. So a 30-day gap produces *identically*
the same distribution as thirty 1-day steps. Splitting or merging intervals is a no-op.

That is what makes irregular sampling principled instead of a fudge. It is asserted numerically in
test `M4` over a grid of `(a, b)` including 200-day and 365-day intervals, again as a 30-step
decomposition, and again inside the filter in test `F6`.

`Δt = 0` gives `F = I` and `Q = 0`, so two weigh-ins at the same instant reduce to two consecutive
Kalman updates — exactly. Test `F7` confirms they commute and that the second one genuinely adds
information.

## Alternatives considered

**Independent diagonal random walks**, `Q(Δt) = diag(σ_w²Δt, σ_v²Δt)`. Two parameters, no
cross-covariance. Rejected: it does **not** satisfy the splitting identity, so a 30-day gap would
give a different answer from thirty 1-day steps, and every irregular interval becomes an
approximation whose error nobody is tracking. It is also harder to defend in an interview, which
matters for this project.

**Adding a small independent level-jitter term** `σ_w²Δt` to `Q[0,0]`, for short-term physiological
wobble not captured by `R`. Deferred, not rejected — it is a one-line change to `process_noise` and
an extra parameter. The open question is whether it is distinguishable from measurement noise at all;
that needs real data, so it belongs to the evaluation milestone.

## Multiple observations at the same or nearly the same instant

**Keep every observation.** Nothing is discarded or aggregated. The filter absorbs each one
individually and `Δt = 0` handles simultaneity exactly.

Known approximation: three weigh-ins minutes apart are highly correlated in reality, but the model
treats them as independent draws with variance `R`, so it shrinks `P_ww` more than it should. This is
recorded rather than hidden. The daily-median alternative is a Week 2 A/B experiment
(ADR-0004); `Observation.obs_variance` already exists as the hook for inflating variance on
clustered readings instead.

## Parameterisation

`σ_a` has units kg·day^(−3/2), which nobody can sanity-check by eye, so the prior is stated in
product terms and converted:

```
"the weekly rate can wander by d kg/week over the course of one week"
    →  σ_a = d / (7·√7)
```

Derivation: `sd(Δv) = σ_a√Δt` kg/day; at `Δt = 7` days, expressed as a weekly rate,
`d = 7·σ_a·√7`. Default `d = 0.15` gives `σ_a ≈ 0.0081`.
See `sigma_accel_from_weekly_rate_drift` and test `U3`.

## Consequences

Good: one parameter instead of two; irregular and simultaneous observations correct by construction;
a strong non-obvious property test (`M4`) that would catch almost any error in `Q`.

Cost: the model has no mean reversion, so its spread grows like `σ_a√(t³/3)` — about 1.6 kg over 50
days but about 400 kg over 2000. It is a *local* model, valid over the product's 30-day horizon and
meaningless over years. Recorded in test `F11` and in `docs/mathematics.md` §8.4.

Related: [ADR-0001](ADR-0001-state-and-units.md),
[ADR-0004](ADR-0004-multiple-observations-per-day.md)

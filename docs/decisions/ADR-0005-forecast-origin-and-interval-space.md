# ADR-0005 — Forecast origin, total elapsed time, and which interval is reported

**Status:** accepted, Milestone 1

Three related decisions about what a forecast actually means.

---

## 1. The forecast origin is a parameter, and propagation uses total elapsed time

### Context

"30-day forecast" is ambiguous when the last weigh-in was not today. If someone last stepped on the
scale five days ago, a forecast anchored to that reading and labelled "30 days" is really a
35-day-old view of the future, and it understates uncertainty by five days' worth of drift.

But a core that reads the clock is not deterministically testable, and the golden regression test
depends on determinism.

### Decision

`origin` is an explicit parameter on `forecast_at` and `forecast_path`, defaulting to the state's own
timestamp — that is, the last observation. The core never reads the clock; the API layer will pass
the current instant.

**Horizons are measured from the origin, but propagation is over total elapsed time.** With the last
observation at `t_T`, the origin at `t_org ≥ t_T`, and lead time `λ = t_org − t_T`, a horizon `h`
propagates the state over

```
τ = λ + h
```

not over `h` alone:

```
w̄(h)    = ŵ_T + v̂_T·τ
P_ww(h) = P_ww + 2τ·P_wv + τ²·P_vv + σ_a²·τ³/3
```

The five intervening days are real elapsed time during which the trend both moved and became less
certain, so they must be propagated through. The reported `horizon_days` stays `h`, because that is
what the label means to the user; only the propagation uses `τ`.

Implemented in `_propagated_point` (`total_days = lead_days + horizon_days`) and `_lead_days`, which
rejects `t_org < t_T` — forecasting into the past is a smoothing problem, not a forecasting one.

### Verification

Test group `P5` checks this four ways, because getting it wrong is easy and silent:

1. `test_p5_propagation_uses_the_total_elapsed_time_not_just_the_horizon` — asserts the mean, the
   standard deviation and the timestamp against the closed form evaluated at `τ`, for four `(λ, h)`
   combinations. Checked **directly against the closed form**, not by comparing two code paths: a
   test that only compared code paths could pass while both were wrong.
2. `test_p5_the_lead_time_is_not_silently_dropped` — a non-zero lead must change both mean and
   variance. Guards specifically against `τ = h`.
3. `test_p5_shifting_the_origin_is_the_same_as_extending_the_horizon` — 30 days from a +5-day origin
   equals 35 days from the state, and only the reported label differs.
4. `test_p5_the_whole_path_is_offset_by_the_lead_time` — every point on the path, not just the
   endpoint.

`test_p5_a_stale_last_weigh_in_widens_the_forecast` records the product consequence: the longer since
the last reading, the less certain the forecast.

### Consequences

Good: deterministic tests, and a correct "30 days from now" available to the API without changing the
mathematics. Cost: callers who want "from now" must pass it; the default is "from the last
observation", which must be labelled accurately in any UI.

---

## 2. Intervals describe the latent weight, not a future scale reading

### Context

Two different predictive distributions exist at horizon `h`: the latent weight `w_{T+h}`, and the
reading a scale would show, `y_{T+h} = w_{T+h} + ε`. The second is wider by exactly `R`.

### Decision

Report the **latent** interval by default. `include_observation_noise=True` adds exactly `R` for the
observation-space version; it is off everywhere in Milestone 1 (tests `P9`).

The product phrases its output as "30-day estimated trend weight — likely range", and the
whole premise of the product is that the trend is the meaningful quantity and the individual reading
is noise. Reporting the reading's interval would reintroduce exactly the noise the product exists to
remove.

### Consequences

The interval answers "where will my underlying weight be", not "what will the scale say". If a UI
ever promises the latter, it must set the flag — and `ForecastResult.includes_observation_noise`
records which question was asked so the two can never be confused downstream.

---

## 3. The trajectory is filtered, not smoothed

### Context

Two histories can be shown. The filtered path is what the model believed at each instant using only
data available then. The smoothed path is the most probable trajectory given everything known now.
They differ, and the smoothed one looks better.

### Decision

Milestone 1 returns the **filtered** path only. `AnalysisResult.trajectory` is one posterior per
observation from the online pass.

It is the honest answer to "what should I have believed at the time", and it means a point on the
graph never changes retroactively — a user who screenshots today's estimate will see the same number
tomorrow. It is also the only pass that exists yet.

### Consequences

The filtered path lags a genuine turning point, which is visible and expected. An RTS smoother is
a later milestone; the per-step priors and posteriors recorded in `FilterStep` are exactly its input,
so adding it requires no change to the filter. Whether the product should then *show* the smoothed
path — and how to explain that history moved — is a product question deliberately left open.

Related: [ADR-0002](ADR-0002-process-noise-and-irregular-dt.md),
[ADR-0003](ADR-0003-initialization.md)

# ADR-0003 — Initialisation, and the priors it depends on

**Status:** accepted, Milestone 1

## Context

The product must work from one measurement and be honest about it. The product forbids crude
gates such as "five measurements unlock forecasting" — uncertainty itself has to carry that
information. So the filter needs a starting state that is defensible with `n = 1`.

It also must not be possible for a user's goal to bias the estimate (§4). If someone selects "lose
weight" and the data says they are gaining, the product must say gaining.

## Decision

```
t₀ = first observation time
x₀ = [y₀, 0]
P₀ = [[R₀,          0],
      [ 0, σ_v0²     ]]
```

The **first observation is consumed by initialisation**, and filtering proceeds from observation 1.
Implemented in `initial_state`, called by `run_filter`.

## Why this and not something else

**Why `P₀[0,0] = R₀` rather than an arbitrary large variance.** Under a flat prior on `w`, a single
Gaussian measurement gives exactly `w | y₀ ~ N(y₀, R₀)`. So `R₀` is not a guess — it is the exact
posterior. With `σ_obs = 0.5` kg, one measurement yields a 95% interval of ±0.98 kg, which is a
truthful statement about what a single weigh-in tells you. Test `F1` pins this.

**Why consume the first observation instead of updating on it.** Initialising the mean at `y₀` and
*then* running an update on `y₀` would use the same measurement twice, shrinking `P_ww` below the
truth. Consuming it is both cleaner and exactly correct.

**Why velocity mean zero.** A single point carries no velocity information. Zero is the only
goal-neutral answer, and it makes the honest minimal-data behaviour fall out for free: with one
observation the product reports a weight and no trend. Test `F1` asserts `v = 0` and
`v_sd == σ_v0` — the velocity posterior *is* the prior, as it must be.

**Goal neutrality is structural, not procedural.** The core takes no goal parameter. There is no
argument, field or config through which a lose/maintain/gain preference could reach the estimator, so
the guarantee does not rest on anyone remembering to honour it.

## The priors, and their honesty

Three defaults. All are documented priors; none is fitted to data.

| Prior | Default | Meaning |
| --- | --- | --- |
| `σ_obs` | 0.5 kg | how far one weigh-in typically sits from the latent weight |
| weekly-rate drift `d` | 0.15 kg/week per week | how fast the trend can change (→ `σ_a ≈ 0.0081`) |
| initial weekly-rate spread | 1.0 kg/week | → `σ_v0 ≈ 0.1429` kg/day |

`σ_v0` is the one with no principled source. It matters most at `n = 2`, where the velocity
posterior is prior-dominated: with two readings 7 days apart differing by −0.7 kg, the filter reports
about −0.47 kg/week rather than the naive −0.7 kg/week, and the estimate is *not* yet distinguishable
from zero at 95% (test `F2`). A weekly-rate spread of 1.0 kg/week is weakly informative — it admits
any realistic human rate while preventing two noisy points from implying an absurd trend.

`FilterResult.loglik` is accumulated precisely so all three can be fitted by maximum likelihood later
without restructuring anything. Until they are, no accuracy claim attaches to them.

## Alternatives considered

**Exact diffuse initialisation / information filter** — start with infinite variance on both
components and handle the first steps in information form. More rigorous, and standard in the
state-space literature. Rejected for Milestone 1: it adds real complexity for a case the simple rule
already handles exactly for `w`, and it does not remove the need to choose a velocity prior in a
product that must answer at `n = 2`.

**Estimating the initial velocity from the first few observations** — rejected. It is a hidden
minimum-data gate, it leaks future information into the prior, and it makes the `n = 1` case
undefined.

**Larger `P₀[0,0]`, e.g. (2 kg)²** — rejected as an arbitrary number that overstates uncertainty
about a quantity the first measurement genuinely pins down to `R₀`.

## Consequences

Good: `n = 1` and `n = 2` behave honestly with no special-casing; no magic thresholds anywhere; goal
bias is structurally impossible.

Cost: `σ_v0` is a judgement call that visibly affects early-data behaviour, and it is unvalidated. A
sensitivity sweep belongs to the evaluation milestone. Note also that `loglik` is the likelihood of
observations 2..n *conditional on the first*, since the initialising observation has no predictive
density — the correct convention here, but it must be remembered when comparing likelihoods across
different series lengths.

Related: [ADR-0002](ADR-0002-process-noise-and-irregular-dt.md),
[ADR-0005](ADR-0005-forecast-origin-and-interval-space.md)

# Mathematics of the HealthTrend core

Every equation below names the file and symbol that implements it. If an equation appears here
and no code implements it, one of the two is wrong.

Scope: latent weight, uncertainty, trend velocity, and probabilistic forecasts at 7, 30 and 90 days.
None of it has changed since Milestone 1 — Milestones 2 to 5 put an HTTP boundary, a frontend, manual
entry and CSV import *above* this layer without touching it, and the golden fixture is byte-identical.
Trend classification, plateau probability, change detection, goal projection, robust filtering and
smoothing are later milestones and appear nowhere in this document except as noted limitations.

---

## 1. Units and the time coordinate

The core works in exactly one system of units. Conversions happen at the boundary and nowhere else.

| Quantity | Unit | Symbol | Code |
| --- | --- | --- | --- |
| latent weight | kg | $w$ | `StateEstimate.w_kg` |
| trend velocity | kg/day | $v$ | `StateEstimate.v_kg_per_day` |
| time | fractional days | $t$ | `TimeAxis.to_days`, `TimeAxis.elapsed_days` |
| displayed rate | kg/week | $r$ | `StateEstimate.weekly_rate_kg` |
| measurement noise SD | kg | $\sigma_{obs}$ | `ModelParams.sigma_obs_kg` |
| process-noise intensity | kg·day<sup>−3/2</sup> | $\sigma_a$ | `ModelParams.sigma_accel` |
| initial velocity prior SD | kg/day | $\sigma_{v0}$ | `ModelParams.sigma_v0` |

$$r_t = 7\,v_t, \qquad \operatorname{sd}(r_t) = 7\operatorname{sd}(v_t)$$

`app/core/units.py` — `per_day_to_per_week`, `per_week_to_per_day`, `DAYS_PER_WEEK`.
The pound is the exact international avoirdupois pound, `KG_PER_LB = 0.45359237`.

**Time is elapsed time, never a step index.** `TimeAxis.elapsed_days` subtracts two aware
datetimes directly, so results are exactly independent of the epoch (tests `T5`, `F6`). Naive
datetimes are rejected by `require_utc_aware`: a naive datetime does not identify an instant, and
the core will not guess a timezone. Normalising timezones belongs to ingestion.

---

## 2. State-space model

### State and observation

$$\mathbf{x}_t = \begin{bmatrix} w_t \\ v_t \end{bmatrix}, \qquad
H = \begin{bmatrix} 1 & 0 \end{bmatrix}, \qquad
y_t = H\mathbf{x}_t + \epsilon_t, \quad \epsilon_t \sim \mathcal{N}(0, R_t)$$

`app/core/model.py` — `H`, `STATE_DIM`. $R_t = \sigma_{obs}^2$ via `ModelParams.obs_variance`, or a
per-observation override via `Observation.variance` (reserved for later robust observation models,
see §8.3). No caller sets it: `Observation.obs_variance` is not exposed by any request schema, so
every observation currently resolves to the same $R$.

### Transition

$$F(\Delta t) = \begin{bmatrix} 1 & \Delta t \\ 0 & 1 \end{bmatrix}, \qquad \Delta t \ge 0$$

`app/core/model.py` — `transition_matrix`. Negative intervals raise `CoreError`; sorting is
ingestion's responsibility. $\Delta t = 0$ gives the identity, which is what makes two weigh-ins
recorded at the same instant reduce to two consecutive updates — exactly, not approximately
(test `F7`).

### Process noise

Velocity is a Wiener process with intensity $\sigma_a$; weight is its integral. This is the
continuous white-noise-acceleration (integrated Wiener) model:

$$Q(\Delta t) = \sigma_a^2 \begin{bmatrix} \Delta t^3/3 & \Delta t^2/2 \\ \Delta t^2/2 & \Delta t \end{bmatrix}$$

`app/core/model.py` — `process_noise`.

**Why this form and not a diagonal random walk.** It is the integral of the continuous-time
noise through the dynamics, $Q(\Delta t) = \int_0^{\Delta t} F(s)\,Q_c\,F(s)^\top\,ds$ with
$Q_c = \operatorname{diag}(0, \sigma_a^2)$, and every covariance generated that way satisfies the
time-splitting identity

$$F(b)\,Q(a)\,F(b)^\top + Q(b) = Q(a+b)$$

This form is the minimal one-parameter member of that family (the level-jitter variant in
ADR-0002 is another member and also satisfies the identity); a diagonal random walk is not a
member and fails it.

Expanding the $(1,1)$ entry: $a^3/3 + a^2b + ab^2 + b^3/3 = (a+b)^3/3$; the $(1,2)$ entry gives
$a^2/2 + ab + b^2/2 = (a+b)^2/2$; the $(2,2)$ entry gives $a + b$. So a 30-day gap yields
*identically* the same distribution as thirty 1-day steps. That identity is what makes irregular
weigh-in times principled rather than approximated, and it is asserted numerically in test `M4`
and again inside the filter in `F6`. A diagonal $\operatorname{diag}(\sigma_w^2\Delta t,
\sigma_v^2\Delta t)$ does **not** satisfy it, which is why it was rejected (ADR-0002).

---

## 3. Initialisation

$$t_0 = \text{first observation time}, \qquad
\hat{\mathbf{x}}_0 = \begin{bmatrix} y_0 \\ 0 \end{bmatrix}, \qquad
P_0 = \begin{bmatrix} R_0 & 0 \\ 0 & \sigma_{v0}^2 \end{bmatrix}$$

`app/core/model.py` — `initial_state`. Called by `run_filter`, which then filters observations
$1 \ldots n-1$.

The first observation is **consumed by initialisation**, not by an update. Two consequences:

- No double counting. Under a flat prior on $w$, one Gaussian measurement gives exactly
  $w \mid y_0 \sim \mathcal{N}(y_0, R_0)$ — so $P_{0,ww} = R_0$ is the exact posterior, not an
  arbitrary starting variance (test `F1`).
- A single measurement carries no velocity information, so the velocity prior stands untouched with
  mean zero. With one data point the model reports the weight and declines to invent a trend
  (ADR-0003). It is also structurally incapable of being biased by a user's goal: the core
  has no parameter through which a goal could reach it.

$\sigma_{v0}$ is a genuine prior choice, not derivable — see §8 and ADR-0003.

---

## 4. Filter recursion

`app/core/kalman.py` — `predict`, `update`. `app/core/filter.py` — `run_filter`.

### Predict

$$\hat{\mathbf{x}}_{t|t-1} = F_t\hat{\mathbf{x}}_{t-1|t-1}, \qquad
P_{t|t-1} = F_t P_{t-1|t-1} F_t^\top + Q_t$$

Then symmetrise. Covariance grows here for two distinct reasons: an uncertain velocity extrapolated
over a longer lever arm (the $FPF^\top$ term) and drift in the trend itself (the $Q$ term). Both are
why forecast intervals widen (tests `K1`).

### Innovation and gain

$$\nu_t = y_t - H\hat{\mathbf{x}}_{t|t-1}, \qquad
S_t = H P_{t|t-1} H^\top + R_t, \qquad
K_t = P_{t|t-1}H^\top S_t^{-1}$$

$S_t$ is scalar, so the "inverse" is a true division — no matrix inversion anywhere in the core.
`KalmanUpdate.innovation`, `.innovation_var`, `.gain`.

### Update — Joseph form

$$\hat{\mathbf{x}}_{t|t} = \hat{\mathbf{x}}_{t|t-1} + K_t\nu_t, \qquad
P_{t|t} = (I - K_tH)P_{t|t-1}(I - K_tH)^\top + K_tR_tK_t^\top$$

Joseph form is used from the start rather than the shorter $(I-K_tH)P_{t|t-1}$. Both are
algebraically identical (test `K3` checks they agree to $10^{-10}$); only this one stays symmetric
and positive semi-definite when accumulated over thousands of steps. Test `K3` chains 2000 updates
and a 500-step near-zero-$R$ stress case; `F9` runs 1825 daily observations and requires
$\max|P - P^\top| < 10^{-12}$ throughout.

### Covariance hygiene

$P \leftarrow (P + P^\top)/2$ after every predict and update — `symmetrize`. The algebra guarantees
symmetry; floating point does not, and asymmetry compounds. `validate_covariance` checks shape,
finiteness, symmetry, positive variances and a non-negative determinant; it is called from the tests
on every recorded step rather than on the hot path.

### Diagnostics recorded per observation

`FilterStep` stores the prior, posterior, $\nu_t$, $S_t$, the normalised innovation
$z_t = \nu_t/\sqrt{S_t}$, $K_t$, and the log-likelihood contribution

$$\ell_t = -\tfrac{1}{2}\left(\log 2\pi + \log S_t + z_t^2\right)$$

`FilterResult.loglik` is $\sum_t \ell_t$ over observations $1 \ldots n-1$ — the conditional
likelihood given $y_0$, since the first observation initialises a diffuse prior and has no
predictive density. Not a product output. It is recorded so that parameters can be fitted by maximum
likelihood later without restructuring anything.

---

## 5. Uncertainty reported to the user

$$\hat w_t \pm z_{0.975}\sqrt{P_{t,ww}}, \qquad z_{0.975} = 1.959963984540054$$

`types.py` — `Z_95`, `StateEstimate.w_interval`, `.w_ci95`, `.w_sd`. This multiplier is usually
written as $1.96$; `Z_95` is that value unrounded, referenced as a named constant so the choice
is stated once rather than scattered as a literal.

---

## 6. Forecast propagation

`app/core/forecast.py` — `propagate`, `forecast_at`, `forecast_path`. A forecast is a prediction with
no measurement after it, so these reuse `kalman.predict` rather than reimplementing propagation.
Everything is analytic; the model is linear and Gaussian, so no simulation is needed.

### Horizons are measured from the origin; propagation uses total elapsed time

The last observation is at $t_T$, the forecast origin at $t_{org} \ge t_T$, and a horizon $h$ means
$h$ days *after the origin*. Writing the lead time $\lambda = t_{org} - t_T$, the state is carried
forward over

$$\tau = \lambda + h$$

**not** over $h$ alone:

$$\hat{\mathbf{x}}(h) = F(\tau)\,\hat{\mathbf{x}}_T, \qquad
P(h) = F(\tau)\,P_T\,F(\tau)^\top + Q(\tau)$$

which for the weight component is

$$\bar w(h) = \hat w_T + \hat v_T\,\tau, \qquad
P_{ww}(h) = P_{ww} + 2\tau P_{wv} + \tau^2 P_{vv} + \tfrac{1}{3}\sigma_a^2\tau^3$$

`_propagated_point` computes `total_days = lead_days + horizon_days` and passes that to `predict`;
`_lead_days` computes $\lambda$ and rejects $t_{org} < t_T$.

When the origin defaults to the last observation, $\lambda = 0$ and $\tau = h$. When it does not —
the user last weighed in five days ago and wants "30 days from now" — those five days are real
elapsed time during which the trend both moved and became less certain, so they must be propagated
through. The reported `horizon_days` stays $h$, because that is what the label means to the user;
only the propagation uses $\tau$.

Verified by tests `P5`: the closed form is checked directly against $\tau$ for four
$(\lambda, h)$ combinations, a non-zero lead is required to change both mean and variance, and the
whole path is checked to be offset by $\lambda$. Checking the closed form directly matters — a test
that only compared two code paths could pass while both were wrong.

### The band, and why it widens

The three terms after $P_{ww}$ are current-weight uncertainty, current-velocity uncertainty over a
longer lever arm, and drift in the trend itself. The $\tau^3$ term is what makes distant forecasts
honestly vague rather than confidently wrong (test `P3` isolates it; `P6` shows
$\text{width}(7) < \text{width}(30) < \text{width}(90)$).

Intervals describe the **latent** weight, matching what the product means by "30-day estimated trend
weight" (ADR-0005). `include_observation_noise=True` adds exactly $R$ to describe a future
scale reading instead — a different question, and not what the product reports (test `P9`).

Because of the splitting identity in §2, propagating in daily steps and in one jump agree exactly, so
`forecast_path` can draw the band at any granularity and its final point equals `forecast_at`
(tests `P4`). Horizon zero reproduces the state being forecast from, so the historical line and the
forecast join without a visual discontinuity.

The horizon is a parameter throughout. The API publishes three fixed values — 7, 30 and 90 days
(`FORECAST_HORIZONS_DAYS` in `app/schemas/analysis.py`) — which are these same equations evaluated at
three values of $h$, drawn from one daily path so every published horizon lands on the grid exactly.
Adding or moving a horizon needs no additional mathematics.

---

## 7. What the numbers look like in practice

From the committed golden fixture (`backend/tests/fixtures/golden_gradual_loss.json`): 60 daily
synthetic observations, true trend $-0.35$ kg/week from 80.0 kg, measurement noise SD 0.4 kg.

| Quantity | Value |
| --- | --- |
| true latent weight at day 59 | 77.05 kg |
| estimated latent weight | 77.139 kg |
| estimated weekly rate | −0.326 kg/week (true −0.35) |
| 30-day forecast | 75.74 kg |
| 30-day 95% interval | 73.36 – 78.13 kg |
| log-likelihood | −46.43 |

The forecast interval spans ±2.4 kg. That width is dominated by velocity uncertainty carried over 30
days, and it is the honest answer from 60 noisy readings — not a defect to tune away.

---

## 8. Assumptions and limitations

These are stated because they are load-bearing, and none of them has been validated against real
data.

1. **The parameter defaults are priors, not fitted values.** $\sigma_{obs} = 0.5$ kg,
   weekly-rate drift $d = 0.15$ kg/week per week (giving $\sigma_a \approx 0.0081$), and an initial
   weekly-rate spread of $1.0$ kg/week (giving $\sigma_{v0} \approx 0.1429$ kg/day). They are
   plausible, documented, and unfitted. They determine how hard the product smooths, so they are the
   biggest single influence on user-visible behaviour. `FilterResult.loglik` exists so they can be
   fitted by MLE later.

   Priors are stated in product units and converted, because $\sigma_a$ in kg·day<sup>−3/2</sup> is
   not humanly checkable. From $\operatorname{sd}(\Delta v) = \sigma_a\sqrt{\Delta t}$ over
   $\Delta t = 7$ days, expressed weekly: $d = 7\sigma_a\sqrt 7$, hence
   $\sigma_a = d/(7\sqrt 7)$ — `sigma_accel_from_weekly_rate_drift` (test `U3`).

2. **Intervals are exact only for fixed parameters.** Once the $\sigma$ values are fitted from the
   same data, the 95% intervals understate uncertainty because they ignore parameter uncertainty.
   Coverage on real data is unmeasured.

3. **No robustness to outliers, by design.** The Gaussian filter is linear, so a spike of $\delta$
   displaces the estimate by exactly $K_w\delta$. Measured on the F10 scenario: $K_w = 0.165$, so a
   single mistyped $+10$ kg reading moves the latent estimate by **1.65 kg** and the reported weekly
   rate by **1.04 kg/week**. Two weeks later the rate is still 0.22 kg/week off a true
   −0.38 kg/week — a trend reported 57% too steep. The transient is a damped *oscillation*, so it
   does not decay monotonically. Tests `F10` record all of this as characterisation. A later
   robust-observation milestone addresses it; until then, do not describe this system as robust.

4. **The model has no mean reversion, so it is only locally valid.** Latent weight is an integrated
   random walk: its spread grows like $\sigma_a\sqrt{t^3/3}$ — about 1.6 kg over 50 days, about
   400 kg over 2000. Simulating from the model for 2000 days produces weights no body could have.
   This is a true property of a local-linear-trend model, not a simulator bug, and it is why the
   product forecasts 30 days rather than 3 years. Test `F11` records it, and calibration is measured
   over many short independent draws rather than one long one.

5. **Simultaneous observations are treated as independent.** Three weigh-ins minutes apart are
   highly correlated in reality, but the model absorbs each with variance $R$ and so shrinks
   $P_{ww}$ more than it should. Keeping every observation was the deliberate choice (ADR-0004); the
   independence is an approximation, and the daily-median alternative remains an open experiment.

6. **A local-linear trend cannot represent a plateau or reversal as structure.** It tracks them by
   drifting velocity, which lags. Expected; a later change-detection milestone addresses it.

7. **The trajectory is filtered, not smoothed.** Each point reflects only data available at that
   instant. The retrospective view needs an RTS smoother; the per-step priors and
   posteriors recorded in `FilterStep` are exactly its input.

8. **Calibration is demonstrated only on data drawn from the model itself.** Test `F11` shows mean
   $z^2 \approx 1$ and about 95% interval coverage when the model is true by construction. That
   validates the implementation, not the model choice. Real-data evaluation is a later milestone.

---

## 9. Equation-to-code index

| Equation | File | Symbol |
| --- | --- | --- |
| $F(\Delta t)$ | `app/core/model.py` | `transition_matrix` |
| $Q(\Delta t)$ | `app/core/model.py` | `process_noise` |
| $H$ | `app/core/model.py` | `H` |
| $R_t$ | `app/core/types.py` | `ModelParams.obs_variance`, `Observation.variance` |
| $\hat{\mathbf{x}}_0, P_0$ | `app/core/model.py` | `initial_state` |
| $(P+P^\top)/2$ | `app/core/model.py` | `symmetrize` |
| PSD / symmetry checks | `app/core/model.py` | `validate_covariance` |
| predict step | `app/core/kalman.py` | `predict` |
| $\nu_t, S_t, K_t$, Joseph update, $\ell_t$ | `app/core/kalman.py` | `update` |
| $z_t = \nu_t/\sqrt{S_t}$ | `app/core/kalman.py` | `KalmanUpdate.normalized_innovation` |
| filter over irregular $\Delta t$ | `app/core/filter.py` | `run_filter` |
| $\sum_t \ell_t$ | `app/core/filter.py` | `FilterResult.loglik` |
| $r_t = 7v_t$ | `app/core/units.py` | `per_day_to_per_week` |
| $\sigma_a = d/(7\sqrt7)$ | `app/core/units.py` | `sigma_accel_from_weekly_rate_drift` |
| $\hat w_t \pm z\sqrt{P_{ww}}$ | `app/core/types.py` | `StateEstimate.w_interval` |
| $\tau = \lambda + h$ | `app/core/forecast.py` | `_propagated_point`, `_lead_days` |
| $\bar w(h), P_{ww}(h)$ | `app/core/forecast.py` | `propagate`, `forecast_at` |
| forecast band | `app/core/forecast.py` | `forecast_path` |
| whole pipeline | `app/core/analyse.py` | `run_analysis` |

# M7A pre-registration: plan alignment and departure detection

The constants below are mirrored in `backend/evaluation/plan_alignment.py` (`PREREGISTRATION`)
and are copied into the `_config` block of every committed M7A result file. Test `EV16` fails if
the committed results were produced under different values. Any deviation made after results
existed is recorded in the "Deviations" section at the bottom of this file, with its reason. None
may be made silently.

### Status and limits of this pre-registration

This is a same-session pre-registration, and it is weaker than an independent one. Read it with
these facts in mind:

- It was written in the same working session as the study code, by the same author.
- The `PREREGISTRATION` constants were fixed before the first full-scale run.
- The prose of this document was finalised after that first run.
- No independent timestamp proves that the rules preceded the results. The only evidence of
  precedence is the account given here.
- No threshold, rule, regime or role changed after results existed.
- The full-scale study ran twice. The two runs produced byte-identical result files, and the result
  files in the repository are the output of the second run.

Everything is synthetic. No real health data is used. Nothing here changes the shipped estimator,
`ModelParams`, the golden fixtures, the API, the frontend or any current product claim.

---

## 1. Questions

1. **On-plan probability.** Given the shipped filter's posterior velocity and a user-supplied target
   weekly rate with a tolerance, is the probability that the underlying rate lies inside the plan
   band calibrated, sharp enough to be useful, and robust enough to be shown?
2. **Departure detection.** Can any rule built from the shipped filter's recorded information (the
   posterior velocity, or the normalised innovations) state "the evidence has departed from the
   intended trajectory" with a controlled false-claim rate, useful power and delay, and without a
   single abnormal reading becoming a claimed departure?

HealthTrend reports *consistent with* or *departed from*. No rule here prescribes adjusting or
holding, and no result is read as such.

## 2. Protocol

| Item | Value |
| --- | --- |
| Phase length | 84 days, first reading at day 0 |
| Check-ins | days 14, 21, 28, ..., 84 (11). **Primary check-ins: 28 to 84 (9)** |
| A check-in at day `c` sees | every reading with elapsed time `<= c`, nothing later |
| Measurement noise | Gaussian, sd 0.5 kg, equal to the shipped `sigma_obs` |
| Base rate | -0.5 kg/week from 80 kg (curved regime: 84 kg) |
| Change day | 42 |
| Plan tolerance `delta` | **0.2 kg/week** (sharpness table also reports 0.1 and 0.3) |
| Series per configuration | 1,000 at full scale |
| Model parameters | the shipped `ModelParams.default()`, untouched |

The posterior at a check-in is the filtered posterior at the last absorbed reading at or before
`c`. Truth labels use the true velocity at that same reading instant, because the synthetic truth
exists only at observation instants.

## 3. On-plan probability

With posterior velocity mean `m` and standard deviation `s`, both converted to kg/week, and plan
band `B = [r* - delta, r* + delta]`:

```
pi = Phi((r* + delta - m) / s) - Phi((r* - delta - m) / s)
```

This is exact arithmetic on a published Gaussian posterior. It is a probability *under the model*
about the *current filtered* rate.

### Trend-established gate

The filter initialises velocity at a prior mean of zero. The posterior velocity mean is linear in
that prior mean, with a coefficient `w_prior` computable exactly from the recorded gains and
intervals: `Phi_n = prod_t (I - K_t H) F(dt_t)`, and `w_prior = |Phi_n[1, 1]|`.

**The probability is computed only when `w_prior <= 0.05`**: at most 5% of the reported rate is the
prior's zero rather than the data. Otherwise the on-plan probability is *not assessable* and no
claim of any kind is made. A zero-span series has `w_prior = 1` exactly, so it is always gated. No
reading count or day count threshold is used.

Baselines have structural gates instead (below). The ungated shipped probability is also recorded,
as a diagnostic of what the gate prevents, never as a candidate.

## 4. Methods

### Probability methods (E6)

| Name | Definition | Assessable when |
| --- | --- | --- |
| `kalman` | shipped filter posterior, formula above | `w_prior <= 0.05` |
| `gated` | **experimental** gated filter (below), same formula | its own `w_prior <= 0.05` |
| `ols28` | OLS slope over readings in `(c - 28, c]`, Student-t probability with `n - 2` df | `n >= 3` and first-to-last spread `>= 14` days |
| `weekly_means` | difference of the means of `(c - 14, c - 7]` and `(c - 7, c]` divided by the difference of their mean times; pooled within-week variance; Student-t with `n1 + n2 - 2` df | `n1 >= 2`, `n2 >= 2` |
| `weekly_means_point` | 1 if the `weekly_means` point rate is inside the band, else 0 | as `weekly_means` |

### Experimental gated filter

Uses `app.core.kalman.predict` and `update` without modifying them. Gate constant **`G = 3.0`**.

- A reading whose normalised innovation against the last absorbed state satisfies `|z| > G` is
  held, not absorbed.
- If the next reading also has `|z| > G` with the same sign, both are absorbed in time order.
- Otherwise the held reading is discarded, and the next reading is treated normally: absorbed if
  `|z| <= G`, or held itself if it exceeds `G` with the opposite sign.
- At a check-in, a held reading is not part of the state.

It is an evaluation-only candidate. Nothing in the product changes if it performs well.

### Departure claim rules (E7)

`alpha_phase = 0.05` over the 9 primary check-ins; Bonferroni per check-in level
`alpha_check = 0.05 / 9`. Bonferroni is valid under any dependence between check-ins.

Plan-relative rules, claiming "the estimated rate has departed from the plan band":

| Rule | Claim at check-in `c` when |
| --- | --- |
| `P1 kalman_plan_05` | `kalman` pi `<= 0.05` |
| `P2 kalman_plan_bonf` | `kalman` pi `<= alpha_check` |
| `P3 kalman_plan_confirmed` | `kalman` pi `<= 0.05` at `c` and at `c - 7`, both assessable |
| `P4 gated_plan_bonf` | `gated` pi `<= alpha_check` |
| `B1 ols28_plan_bonf` | `ols28` pi `<= alpha_check` |
| `B2 weekly_means_point` | `weekly_means_point` is 0, the user heuristic "last week's rate is outside my band" |

Model-relative rules on the shipped filter's normalised innovations `z` in the window `(c - 14, c]`,
`k` innovations, claiming "recent readings are not consistent with the estimated trajectory":

| Rule | Claim when | Needs |
| --- | --- | --- |
| `I1 innov_chi2_bonf` | `sum z^2 > chi2_k quantile(1 - alpha_check)` | `k >= 2` |
| `I2 innov_mean_bonf` | `abs(sum z) / sqrt(k) > Phi^-1(1 - alpha_check / 2)` | `k >= 2` |
| `I3 innov_robust_bonf` | with `psi = clip(z, -2, 2)` and `e = E[psi^2]` under N(0, 1): for **every** `j`, `abs(sum_{i != j} psi_i) / sqrt((k - 1) e) > Phi^-1(1 - alpha_check / 2)` | `k >= 3` |

Under a correctly specified model `z` is exactly iid N(0, 1), so the I-rule thresholds are exact
there and nothing is tuned. A sequential CUSUM was considered and **not** evaluated: under a
per-check-in decision protocol it needs a separate sequential design and a simulated threshold, and
the windowed sum is its fixed-window analogue.

Predictions stated in advance. They are not criteria:

- I1 will be triggered by isolated bad readings.
- No I-rule will detect the gradual rate change, because its 0.125 kg/week-per-week ramp sits inside
  the prior's 0.15 kg/week-per-week drift budget.
- P1 will exceed its phase false-claim target because it is not multiplicity-adjusted.

## 5. Regimes

| Regime | Generator | Schedules |
| --- | --- | --- |
| `model_consistent` | `model_consistent_series`, shipped params | daily, every 3.5 d, weekly; E6 also irregular (18 readings on `IRREGULAR_GAPS_DAYS`) |
| `steady` | `gradual_loss_series`, -0.5 kg/week | daily, every 3.5 d, weekly |
| `steady_irregular` | `irregular_loss_series`, 18 readings on `IRREGULAR_GAPS_DAYS` | irregular |
| `steady_missing` | `linear_series`, each day kept with probability 0.6, day 0 always kept, days 50 to 59 always dropped | missing |
| `bad_reading` | `steady` daily with one reading at day 56 displaced by +2, +3 or +5 kg, paired with its clean twin | daily |
| `level_shift` | `jump_series`, +2.0 kg at day 42 | daily, every 3.5 d, weekly |
| `plateau` | `plateau_series`, -0.5 kg/week until day 42 then flat | daily, every 3.5 d, weekly |
| `gradual_rate_change` | new `rate_change_series`: -0.5 kg/week, ramping linearly from day 42 to 0 at day 70 | daily |
| `curved` | `curvature_series`, 84 kg towards 84 - (0.5/7)*60 kg, time constant 60 d (initial rate exactly -0.5 kg/week) | daily |

### Plan targets

- **E6 calibration.** `model_consistent`: `r* ~ U(-1, 1)` kg/week, independent of the truth, which
  is required for the posterior to be exactly calibrated. Fixed-truth regimes: `r* = r0 + U(-0.5, 0.5)`
  with `r0` the initial true rate. One target per series.
- **E7 nulls.** Target placements `r* = r_true - o * delta` for `o in {0, +0.9, -0.9}`: centre,
  truth near the upper edge, truth near the lower edge. Gating uses the worst placement.
- **E7 alternatives.** `r* = r0`, truth at the band centre before the change.

### Roles and onset times

| Regime | Plan rules | Innovation rules |
| --- | --- | --- |
| `model_consistent` | not used in E7 (covered by E6) | **null** |
| `steady` daily | **null** | **null** |
| `steady` 3.5 d, weekly | null, reported, not gating | null, reported, not gating |
| `steady_irregular`, `steady_missing` | **null** | **null** |
| `bad_reading` | **bad reading** | **bad reading** |
| `level_shift` | nuisance, reported | **alternative**, onset day 42 |
| `plateau` daily | **alternative**, onset = first reading with truth outside band (42) | **alternative**, onset 42 |
| `plateau` 3.5 d, weekly | alternative, reported | alternative, reported |
| `gradual_rate_change` | **alternative**, onset = first reading with truth outside band (day 54 daily) | alternative, onset 42, reported |
| `curved` | **alternative**, onset = first reading with truth outside band | descriptive |

Bold roles gate eligibility; the rest are reported.

## 6. Metrics

- **Phase false-claim rate.** The fraction of series with any claim at a primary check-in. Series
  are the unit, with a Wilson 95% interval.
- **Per-check-in claim rate.** The per-series mean over assessable primary check-ins, with a
  cluster interval.
- **Bad-reading attributable claim rate.** The fraction of series with a claim at some check-in
  from day 56 to day 84 that its clean twin does not make at that check-in.
- **Detection.** The first claim at a check-in `>= onset`. Delay is that check-in minus the onset,
  and a series with no claim by day 84 is censored. Reported: detected within 14 days, within 28
  days, by day 84, and the median delay with censored series counted as infinite. Pre-onset claim
  rates are also reported.
- **E6 calibration.** Pooled over assessable primary check-ins:
  - calibration-in-the-large, the per-series mean of `pi - label` with a cluster interval;
  - ECE over 10 equal-width bins;
  - Brier score per series with a cluster interval, plus paired differences against `kalman` on
    check-ins where both methods are assessable;
  - the departure tail, the in-band frequency among `pi <= 0.05`, as a cluster ratio estimate;
  - the consistency tail, the in-band frequency among `pi >= 0.6`, against the mean `pi` there;
  - sharpness, the share of `pi <= 0.05` and of `pi >= 0.8`;
  - the assessable share.
- **Analytic sharpness table.** For regular schedules every 1, 2, 3.5 and 7 days and histories of 7,
  14, 21, 28, 42, 56 and 84 days plus steady state, report the posterior rate sd, `w_prior`, and the
  largest attainable pi `= 2 Phi(delta / s) - 1` for each `delta`. Computed deterministically from
  the covariance recursion.

## 7. Eligibility criteria

A candidate is **eligible for later productisation** only if every gating criterion holds.
"Eligible" means the evidence does not rule it out. It does not mean the candidate is validated on
real data, and it authorises no product change.

### On-plan probability (`kalman`)

- **E6-A, exact calibration.** On `model_consistent` daily and irregular: the
  calibration-in-the-large interval contains 0, and ECE `<= 0.03`.
- **E6-B, fixed-rate nulls.** On `steady` daily, `steady_irregular` and `steady_missing`:
  - the departure-tail in-band frequency is `<= 0.05`, with an upper 95% bound `<= 0.10`;
  - the consistency-tail in-band frequency is `>= mean pi - 0.05`.
- **E6-C, changing regimes.** On `plateau`, `gradual_rate_change` and `curved`, all daily: the
  departure-tail in-band frequency is `<= 0.10`, with an upper bound `<= 0.15`. `level_shift` is
  reported, not gating.

The `gated` probability is judged by the same criteria and labelled experimental.

### A departure claim rule

- **R-A, false claims.** On every gating null configuration and every gating placement: the phase
  false-claim rate is `<= 0.05`, with a Wilson upper bound `<= 0.075`.
- **R-B, a single bad reading.** For magnitudes +2, +3 and +5 kg and every placement: the
  attributable claim rate is `<= 0.02`.
- **R-C, power.**
  - Plan rules: on `plateau` daily, detection within 28 days `>= 0.80` and median delay `<= 21`
    days; on `gradual_rate_change`, detection by day 84 `>= 0.50`; on `curved`, detection by day 84
    `>= 0.50`.
  - Innovation rules: on `level_shift` daily, detection within 14 days `>= 0.80`; on `plateau`
    daily, detection within 28 days `>= 0.80` and median delay `<= 21` days.

Eligibility established on daily data is scoped to daily weighing. The 3.5-day and weekly results
state whether it extends.

## 8. Seeds

New disjoint blocks `e6` (4,000,000 + 100,000) and `e7` (4,100,000 + 100,000), checked by `EV7`.
Target, schedule and noise streams are distinct generator streams keyed on the series seed.

## Deviations

None. No threshold, rule, criterion, regime or role was changed after results existed. The prose
of this document was finalised after the first full-scale run; see "Status and limits of this
pre-registration" above. The full-scale study ran twice with byte-identical output, and the result
files in the repository are the output of the second run.

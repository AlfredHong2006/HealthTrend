# Milestone 7A: plan alignment and departure detection

What the evidence says about the M7 product direction. The rules are in
[m7a_preregistration.md](m7a_preregistration.md); the numbers are in
[m7a_results.md](m7a_results.md), which is generated from committed result files. This document
is the reading of those numbers.

**Everything here is synthetic.** No real health data was used. **Nothing in the product
changed.** `app/core/**`, `ModelParams`, the golden fixtures, the API, the frontend and every
current product claim are untouched. The studies live in `backend/evaluation/`, which the
application cannot import. The M6 documents are byte-identical.

**The pre-registration is same-session, and weaker than an independent one.** It was written in
the same working session as the study code, by the same author. The `PREREGISTRATION` constants
were fixed before the first full-scale run, and the document's prose was finalised after it. No
independent timestamp proves that the rules preceded the results. No threshold, rule, regime or
role changed after results existed. The full-scale study ran twice with byte-identical output, and
the result files in the repository are the output of the second run.

**Two kinds of eligibility are used here, and they are not the same.** *Research-check eligible*
means a candidate passed the pre-registered research checks on synthetic data. *Product eligible*
means it may be built into the product. **Neither the on-plan probability nor any departure
detector is currently product eligible. Nothing from this study may reach the API or the
frontend.**

---

## The short version

**The on-plan probability passed the pre-registered research checks, which deliberately excluded
level shift.** That makes it research-check eligible, not product eligible. The quantity is
`P(rate in [target - 0.2, target + 0.2] kg/week)`, computed from the shipped posterior velocity
and computed only once the trend-established gate opens.

- It is calibrated on data drawn from the model.
- On the fixed-rate and changing regimes it errs towards caution rather than over-confidence.

It is also:

- **Never sharp.** With the shipped priors it cannot exceed about 0.72 on daily data at a
  0.2 kg/week tolerance. It never reached 0.8 in any configuration.
- **Moved heavily by one bad reading at a check-in.** A +3 kg reading shifts it by a median of
  0.43.
- **Over-confident after a genuine level step.** Of the check-ins where it read at most 0.05, 30%
  had the true rate inside the band.

**No departure rule is research-check eligible, and none is product eligible.** All nine
candidates failed at least one pre-registered criterion. The failures fall into three patterns:

- **Rules built on the shipped posterior control false claims but lack power.** The posterior
  rate sd plateaus at 0.185 kg/week on daily data. That width comes from the process-noise prior,
  which M6 showed cannot be identified per user from a month of data.
- **Rules built on innovations are fast on level shifts and blind to rate changes.** They detected
  95 to 96% of +2 kg steps within 14 days and at most 8% of plateaus within 28 days. The two
  non-robust ones are also triggered by single bad readings.
- **The best-performing rule is a baseline.** A 28-day OLS slope with a Bonferroni threshold
  failed one criterion, curved detection at 42% against 50%, and passed the rest.

So the direction is statistically viable **in part**. An honest, conservative "consistent with /
departed from your planned rate" statement can be computed without over-claiming on steady data.
Stated at a controlled false-claim rate, it arrives too late on the shipped priors to support a
weekly decision loop. It also cannot tell a real rate change from a level step or a single bad
reading. Those are the blockers, listed at the end.

---

## E6: the on-plan probability

### Definition and gate

`pi = Phi((r* + delta - m) / s) - Phi((r* - delta - m) / s)`, where `m` and `s` are the shipped
posterior velocity mean and sd in kg/week. This is arithmetic on a published Gaussian.

**No trend established** is defined without counting readings or days. The posterior velocity mean
is linear in the prior's zero-velocity mean, and its coefficient `w_prior = |Phi_n[1, 1]|` is exact
and computable from the recorded gains. The probability exists only when `w_prior <= 0.05`. Test
`EV12` checks the coefficient against an independent filter started from a different prior mean.

A zero-span series has `w_prior = 1` exactly, so it never opens. On regular schedules the gate
opens at:

| Schedule | Gate opens at |
| --- | --- |
| daily | day 13 |
| every 2 days | day 16 |
| every 3.5 days | day 17.5 |
| weekly | day 21 |

The gate matters. On the irregular and missing-data schedules, the probability computed before the
gate opened said "departed" (`pi <= 0.05`) while the truth was in the band 16 to 18% of the time,
against 0% once the gate was open.

### Calibration: passed, and conservative

- **Model-consistent data.** Calibration-in-the-large contained zero and ECE was 0.007 (daily) and
  0.009 (irregular). This is the check that must pass if the arithmetic is right, and it does.
- **Fixed-rate data: steady, irregular, missing.** No check-in with `pi <= 0.05` had the truth in
  the band, with upper bounds of 1.1 to 1.6%. Where `pi` averaged about 0.68, the truth was in the
  band 85 to 89% of the time. The probability is **under-confident**, with ECE about 0.12 to 0.13.
  The process-noise prior keeps forgetting old readings, which a fixed true rate does not require.
  This is the safe direction for a "departed" claim.
- **Changing data: plateau, gradual rate change, curved.** In the departure tail the truth was in
  band 1.6%, 0.5% and 0.04% of the time respectively, all well inside the pre-registered 10%.
- **Level shift, reported not gating.** The departure tail had the truth in band **30%** of the
  time. A genuine +2 kg step is absorbed partly as a rate change, so the probability says "departed"
  for a trajectory whose rate never moved. The experimental gated filter does not change this at
  32%, because it is designed to follow confirmed steps.

### Sharpness: the finding that matters most for the product

With the shipped priors the posterior rate sd on daily data settles at **0.185 kg/week** by day 28
and never shrinks further. The largest on-plan probability it can then report is:

| Tolerance, kg/week | Largest attainable pi, daily |
| --- | --- |
| 0.1 | 0.41 |
| 0.2 | 0.72 |
| 0.3 | 0.90 |

Weekly weighing lowers the 0.2 ceiling to 0.64. In the simulation the shipped probability reached
0.8 on **0%** of check-ins in every configuration.

For comparison, a 28-day OLS slope on the same daily data has a standard error of about
0.08 kg/week. On steady data it was both sharper (27% of check-ins at `pi >= 0.8`) and better
calibrated (ECE 0.010). Its Brier score beat the shipped posterior on steady, curved and
level-shift data, and lost on model-consistent, plateau, gradual, irregular and missing data.

That is the M6 Holt result in a new form. The shipped estimator assumes the rate wanders at
0.15 kg/week per week. When the rate truly is constant, a simpler method that assumes constancy is
sharper. When the rate changes, the shipped estimator's willingness to forget is what keeps it
calibrated. The width is set by `sigma_accel`, the parameter M6 found unidentifiable from a month
of data.

**Consequence.** On the shipped priors HealthTrend can honestly say *the evidence has departed from
your planned rate*. It cannot honestly say *you are on plan* with high probability, only *the
evidence is consistent with your plan*, meaning it does not exclude it. That asymmetry fits
"consistent with / departed from" language. It does not fit a confident weekly "on track".

### One bad reading

A single reading displaced upwards at day 56, paired with its clean twin, target at the true rate:

| Reading | Median change in pi at day 56 | 90th percentile |
| --- | --- | --- |
| +2 kg | 0.24 | 0.38 |
| +3 kg | 0.43 | 0.53 |
| +5 kg | 0.64 | 0.68 |

A +3 kg reading moves the estimated rate by 0.31 kg/week on the day it arrives. One week later the
rate error has decayed to 0.02 to 0.05 kg/week across the three sizes. By day 70 it has reversed
sign, at -0.07 kg/week for the +3 kg reading, which is the damped oscillation
`docs/mathematics.md` §8.3 describes. The
experimental gated filter reduces the day-56 median change to 0.02 to 0.03. It is evaluation-only and
changes nothing shipped.

### E6 verdict

**The on-plan probability is research-check eligible. It is not product eligible.** It passed the
pre-registered research checks, and those checks deliberately excluded level shift from gating.
Passing them means the synthetic evidence does not rule it out; it does not authorise building it.
Three findings outside the gating criteria are blockers to any product use:

- **Bad-reading sensitivity at the check-in.** A displayed probability can move by 0.4 on one
  mistyped reading.
- **Level-step over-confidence.** 30% of "departed" readings have the truth in band.
- **The sharpness ceiling.** It cannot support "on track" language at any tolerance a cutter would
  use.

The gated variant passes the same research checks. Its bad-reading behaviour is much better, and
it remains an evaluation-only experiment. It is not product eligible either.

---

## E7: departure claims

### What failed, rule by rule

Criteria: phase false-claim rate at most 5% (Wilson upper bound at most 7.5%) on every gating null
and placement; attributable single-bad-reading claims at most 2%; power as pre-registered.

| Rule | False claims on nulls | One bad reading | Power | Verdict |
| --- | --- | --- | --- | --- |
| `kalman_plan_05` | at most 1.1%, pass | **fails**: up to 98% at +5 kg, 45% at +3 kg | **fails**: plateau 67% in 28 d, median delay 28 d; curved 12% by day 84 | not eligible |
| `kalman_plan_bonf` | 0%, pass | **fails**: 61% at +5 kg, 2.7% at +3 kg | **fails**: plateau 6% in 28 d; gradual 3%; curved 0.1% | not eligible |
| `kalman_plan_confirmed` | at most 0.7%, pass | at most 0.3%, pass | **fails**: plateau 20% in 28 d, median 42 d; gradual 9%; curved 0.3% | not eligible |
| `gated_plan_bonf` (experimental) | 0%, pass | at most 0.1%, pass | **fails**: plateau 6% in 28 d; gradual 3.5%; curved 0.1% | not eligible |
| `ols28_plan_bonf` (baseline) | at most 3.3%, pass | at most 1.2%, pass | plateau 87% in 28 d, median 21 d, pass; gradual 75%, pass; **curved 42%, fails** | not eligible |
| `weekly_means_point` (user heuristic) | **92 to 100%** | **58 to 78%** | detects everything, including 52 to 89% before onset | not eligible |
| `innov_chi2_bonf` | at most 4.0%, pass | **fails**: 44%, 93%, 100% | level shift 96% in 14 d, pass; **plateau 4%, fails** | not eligible |
| `innov_mean_bonf` | at most 5.0%, pass | **fails**: 8.9% at +3 kg, 65% at +5 kg | level shift 95% in 14 d, pass; **plateau 8%, fails** | not eligible |
| `innov_robust_bonf` | at most 1.3%, pass | **fails**: 27% at +5 kg, 1.3% at +3 kg | **fails**: level shift 31% in 14 d; plateau 1% | not eligible |

### Reading the pattern

**The shipped-posterior rules cannot trade false claims for speed.** The unadjusted rule is the
fastest, and one bad reading at +5 kg or +3 kg near the band edge is enough to trigger it. The
Bonferroni rule and the confirmation rule are robust, and detect at most 20% of plateaus within
four weeks. The ceiling is the posterior width, not the claim threshold: to separate a 0.5 kg/week
change from a 0.2 kg/week band with sd 0.185, the filter must first fully catch up, and a
local-linear trend catches up by letting velocity drift.

**The innovation rules detect the wrong thing for this product.** The model-relative statistics are
exact under the model: the chi-square and mean rules made 4.0% and 5.0% phase false claims on
model-consistent data, against a Bonferroni bound of 5%. They
see abrupt level steps quickly. A plateau or a gradual rate change is absorbed into the velocity
estimate without ever producing surprising innovations. The pre-registered prediction that no
innovation rule would detect the gradual change held, at 0.1 to 3.4%. These rules could support a
*separate* statement, "recent readings are not consistent with the estimated trajectory". Even
then, the two that see level shifts are triggered by bad readings, and the robust one is too slow
on level shifts. None qualifies.

**The best rule is not the shipped estimator's.** A leakage-safe OLS slope over 28 days, with a
Bonferroni threshold and a Student-t error model, passed the false-claim and bad-reading criteria
and detected 87% of plateaus within 28 days. It failed only on continuous curvature. It also
claims a departure on 99.5% of +2 kg level steps, and it is assessable on only 44% of check-ins on
the irregular schedule. This does not argue for replacing the estimator. A constant-rate window
wins when the rate is constant within the window, which is the E5 lesson again. It does show that
the product question is answerable, and that the shipped priors are what stand in the way.

**Level shifts break every plan rule.** Every plan rule claimed a departure on 91 to 100% of daily
series with a +2 kg step and an unchanged rate. None of the models evaluated separates "the level
moved" from "the rate changed" from a few weeks of readings.

### Frequency and history

- **3.5-day and weekly schedules.** No rule's daily verdict extends to either. Every shipped plan
  rule loses further power: `kalman_plan_05` plateau detection by day 84 falls from 95% daily to
  70% at 3.5 days and 56% weekly. Weekly weighing gives the weekly-means heuristic no
  assessable check-in at all.
- **History.** The gate opens between day 13 (daily) and day 21 (weekly). The probability's
  sharpness reaches its ceiling by day 21 to 28 on every schedule, so waiting longer does not make
  it sharper.

### A prediction that failed

The pre-registration predicted that the unadjusted rule `kalman_plan_05` would exceed its
phase false-claim target. It did not. Its null false-claim rate was at most 1.1%, because the
posterior is under-confident on fixed-rate truths. That under-confidence cost the rule its power.

---

## Eligibility

| Candidate | Research-check eligible | Product eligible | Why |
| --- | --- | --- | --- |
| On-plan probability, shipped posterior, gated at `w_prior <= 0.05` | yes, with level shift excluded from gating | **no** | Bad-reading sensitivity, level-step over-confidence and the sharpness ceiling below are unresolved |
| On-plan probability, gated filter | yes, with level shift excluded from gating | **no** | Evaluation-only experiment; robust observation handling is not authorised for production |
| Any departure claim rule | **no** | **no** | None passed the research checks |

**Nothing from this study may reach the API or the frontend.** Research-check eligibility authorises
no product change. Moving any candidate towards the product would need the blockers below resolved,
new evidence, and a separate decision.

## Remaining blockers

1. **Sharpness is set by an unidentifiable prior.** Useful power needs a narrower posterior rate,
   which needs a smaller `sigma_accel`. That in turn makes plateaus and curvature worse (M6 E5).
   M6 E3 showed `sigma_accel` cannot be fitted per user from a month of data. Pooled fitting across
   users, which M6 found can help, requires real data this project does not have.
2. **A level step is indistinguishable from a rate change.** Every plan rule claims departures on
   genuine level shifts. Separating them needs a model with a level-jump or level-jitter component,
   the term ADR-0002 deferred. That is a change to core mathematics requiring its own ADR and
   evaluation.
3. **Single bad readings.** The shipped probability moves by up to about 0.7 on one reading.
   The gated experiment fixes this in simulation, but robust observation handling is explicitly
   experimental and would be a core change.
4. **No real data.** Every number here is synthetic. Calibration on real weight series is unknown,
   and the regimes are guesses about what cuts and bulks look like.
5. **Curvature.** No rule detected a continuously decelerating loss reliably. That is the shape a
   long cut, and any medication-assisted loss, most resembles.

## What this study licenses saying, and what it does not

**Supportable:**

- On synthetic data, the shipped posterior's on-plan probability is calibrated when the model
  holds, and conservative on fixed-rate and gradually changing trajectories.
- A trend-established gate defined by the exact prior weight prevents early, prior-driven
  "departed" readings.
- With the shipped priors, no evaluated departure rule combines a controlled false-claim rate,
  robustness to a single bad reading, and useful detection speed.

**Not supportable:**

- Any claim that HealthTrend can tell a user they are on track, off track, plateaued or
  decelerating.
- Anything about real data.
- That a simple baseline is the better product. It was better on some regimes and was also not
  eligible.

## Reproducing this

From `backend/`:

```bash
uv run python -m evaluation.run m7a      # about 3 minutes; writes e6 and e7 result files
uv run python -m evaluation.run tables   # regenerates m7a_results.md (and results.md, unchanged)
uv run pytest -q tests/evaluation        # EV12-EV16 among them
```

Test `EV16` fails if the committed M7A results were produced under constants other than the
pre-registered ones, or if `m7a_results.md` has drifted from them.

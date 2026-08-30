# Milestone 6: evaluation

What the estimator does, measured. The numbers are in
[results.md](results.md), which is generated; this document says what they mean.

**Everything here is synthetic.** No real health data has been used for any evaluation, and
nothing in this milestone changes that. Five experiments, all of them simulations in which
the hidden trajectory is known because it was generated.

**Nothing in the shipped model changed.** `app/core/**` and the priors in `ModelParams` are
byte-for-byte what they were at Milestone 5; the golden fixtures still match. Fitting
happens only inside `backend/evaluation/`, which the application cannot import
(`tests/test_layering.py`). The parameters remain documented priors, and one of the findings
below is that, for fitting them per user on the data a real user has, that is the right
choice for reasons that were not previously measured.

---

## The short version

**What now has evidence behind it.** The likelihood and the forecast moments are
arithmetically correct: the two recursions agree across all 810 battery cases, an
independent computation adjudicates 781 of them, and in the ill-conditioned corner where
that computation runs out of precision, exact arithmetic identifies the filter as the
accurate party. On data drawn from the model's own assumptions the 95% intervals cover about
95% of the time — for latent weight and for velocity, on regular and on deliberately awkward
schedules, over 500 series in each of two configurations. Irregular spacing costs nothing,
which is the process-noise splitting identity working as ADR-0002 claimed it would.

**What is now known to be worse than assumed.** The estimator is not uniformly better than
a moving average. On a *flat* trajectory its 30-day forecast is about seven times worse than
a tuned moving average, and on a *plateau* about six times worse; in both cases it
extrapolates a velocity that is mostly noise. Nor is the shortfall confined to regimes the
model was never meant to represent: on the 30-day metric a tuned Holt beats the shipped
estimator in six of the eight regimes — `steady_loss` among them — and a Kalman filter
given parameters fitted to the regime beats it in five. Its intervals, exactly calibrated
under the model, degrade badly under misspecification: on a genuine level jump the 30-day
interval covers the truth 48% of the time against a nominal 95%.

**What is now known that was previously only suspected.** The process-noise intensity
`sigma_accel` is not identifiable from a month of data — not with 30 readings and not with
300. Calendar span, not the number of weigh-ins, is what identifies it. This is the
strongest available argument against per-user parameter fitting, and it is an argument that
did not exist before this milestone.

---

## E1 — the arithmetic is right

The filter accumulates its log-likelihood from innovations, one observation at a time. A
second implementation of the same recursion would reproduce a mistake in it exactly, so the
check is a genuinely different computation: the joint Gaussian density of the whole
observation vector, built from the model's marginal covariances and evaluated with one
Cholesky factorisation. The two share only the definition of the model.

The battery is 810 cases — 27 parameter settings, five gap patterns including simultaneous
readings, six series lengths. Across all 810 the shipped filter and the lean recursion used
for fitting agree to `2.1e-14` relative. The oracle adjudicates 781 of them and agrees with
both to better than `1e-8`. The remaining 29 are ill conditioned *for the oracle* —
covariance condition numbers above `1e8`, where a double-precision Cholesky factorisation
no longer has the digits to settle a comparison at the eighth — and are classified rather
than counted as passes or failures. Forecast means and variances match the conditional
moments of the same joint distribution on the cases the oracle can speak to.

**The interesting part was the disagreement.** Six cases initially exceeded tolerance, all
at 300 readings with covariance condition numbers above `5e9`. In every one, the two
recursions agreed with *each other* far more closely than either agreed with the oracle —
the signature of the oracle being the inaccurate party. Recomputing the worst case at 60
significant digits settled it:

| computation | error against exact arithmetic |
|---|---|
| `run_filter` (Joseph form) | `7.4e-13` |
| lean fitting recursion | `7.4e-13` |
| `O(n^3)` oracle in double precision | `3.7e-05` |

The estimator was accurate to a part in a trillion; the check was wrong by seven orders of
magnitude more. So E1 now applies two criteria: an unconditional one between the two
recursions, and the oracle comparison only where the oracle has precision to spare. That is
a statement about double-precision Cholesky factorisation of an ill-conditioned matrix, not
a tolerance widened to make a test pass — and the exact-arithmetic check is kept as a
permanent test rather than left as an assertion in a commit message.

**What the exact-arithmetic check is, stated precisely.** It is a spot check, pinned as test
`EV1`: one representative ill-conditioned case recomputed at 60 significant digits, which
establishes *which* of the two computations loses accuracy there rather than leaving it
inferred. It is not a per-case adjudication of the 29 ill-conditioned cases, and nothing
here claims independent verification of those 29. What stands behind them is that diagnosis
plus the unconditional recursion agreement, which holds on all 810.

## E2 — calibrated, on its own terms

Five hundred series on a daily schedule and five hundred more on a deliberately irregular
one — 500 per configuration, 1,000 in total — drawn from the model the filter assumes, with
the parameters the filter uses. Under those conditions the posterior *is* the exact
conditional distribution, so coverage must be 95%, the normalised innovations must have unit
mean square, and the
normalised estimation error must average two. Anything else would be an implementation
defect, not a modelling limitation, because there is no modelling error to be limited by.

All eight checks passed, none deviating by more than 0.73 standard errors. Latent-weight
coverage 94.9%, velocity coverage 94.9–94.9%, mean normalised innovation squared 1.006,
mean normalised estimation error squared 1.996–2.013.

Two things worth stating about how this was measured. Inference is clustered by series,
because consecutive posteriors within one trajectory are not independent: the daily
configuration contributes 500 independent replications, not the 30,000 posteriors those
series contain.

How much pooling would have cost is not a single number, and the committed summaries say so.
Against the naive standard error pooling implies — `sqrt(0.95 × 0.05 / n)` for a coverage
rate at its nominal value, `sqrt(2 / n)` for ANIS and `sqrt(4 / n)` for ANEES, with `n` the
pooled count of the quantity being averaged (30,000 posteriors and 29,500 innovations on the
daily configuration, 11,500 and 11,000 on the irregular one) — the clustered standard errors
this study actually reports stand in these ratios:

| statistic | clustered / naive, daily | clustered / naive, irregular |
|---|---|---|
| latent-weight coverage | 2.27× | 1.44× |
| velocity coverage | 2.33× | 1.66× |
| ANIS | 0.99× | 1.04× |
| ANEES | 3.17× | 2.01× |

So three of the four statistics would have been reported with intervals materially too
narrow, by a factor depending on both the statistic and the schedule, while ANIS would have
been left essentially where it is. That the size of the error varies is the point: the unit
of inference has to follow from how the data was generated, not from the interval it happens
to produce.
A calibration study whose own intervals are wrong is worse than none.

And the stop criterion was deliberately not "an interval missed": with eight checks, one
marginal miss is expected about a third of the time under a perfectly correct
implementation, and treating that as proof of a defect would mostly generate false alarms.

**What this does not establish.** That the model is right for real weight data. It
establishes that the implementation is right for the model. `docs/mathematics.md` has said
so since Milestone 1 and still says so; E5 is where misspecification is measured.

The irregular configuration is the one genuinely new claim: on the awkward fixed cycle —
two readings in a day, then a three-week silence — calibration is indistinguishable from the
daily case. ADR-0002 argued that irregular spacing is exact rather than approximated because
`F(b) Q(a) F(b)' + Q(b) = Q(a + b)`. That argument is now also a measurement.

## E3 — calendar time identifies the trend, not weigh-ins

The clearest result in the milestone, and the least expected.

| span | readings | `sigma_accel` interval width | fails to close | detects any drift |
|---|---|---|---|---|
| 30 days | 30 | 4.8 orders of magnitude | 100% | 0% |
| 30 days | 120 | 3.9 | 80% | 24% |
| 30 days | 300 | 3.4 | 68% | 36% |
| 365 days | 30 | 0.55 | 0% | 100% |
| 365 days | 300 | 0.37 | 0% | 100% |

Ten times as many readings over the same month barely helps. A year of data with only 30
readings — one every twelve days — identifies the process noise better than 300 readings
crammed into a month, by a factor of six in interval width. The reason is structural:
`sigma_accel` governs how fast the *trend* changes, and a trend change is only visible over
time. Weighing more often measures the noise better, not the drift.

Measurement noise behaves in exactly the opposite way, and the contrast is the cleanest
illustration of the point: its interval width depends on the reading count (0.24, 0.11,
0.07 orders of magnitude at 30, 120, 300 readings) and hardly at all on the span.

The two boundary questions were kept separate, because conflating them would misstate both.
Profile intervals invert a two-sided test at the usual chi-square quantile, which is right
for covering a true value in the interior. Whether the data can reject "the trend never
drifts" is a hypothesis on the *edge* of the parameter space, where the likelihood-ratio
statistic follows a 50:50 mixture and the critical value is 2.71 rather than 3.84. Both are
reported and labelled. Interval endpoints that never closed are counted at the search bound
and never dropped: dropping them would condition the coverage figure on the replicates where
estimation happened to work, which is the one thing a study of when estimation works must
not do.

The profile intervals themselves cover close to nominal across the grid — 86–98% for
`sigma_obs` and 92–100% for `sigma_accel` against a nominal 95%. Those rates were computed
for all twelve cells and previously printed only for the three the E4 table reports on;
[results.md](results.md) now carries every cell. Two cautions on reading them. Grid cells
carry 50 replicates and diagonal cells 200, so a single cell's coverage carries a Monte
Carlo standard error of about three percentage points at 50 replicates and one and a half at
200 — the range across cells is worth reading, an individual cell is not. And a censored
endpoint counts as covering, which is why the 100% at a 30-day span on 30 readings is a
statement about censoring — that cell censors 100% of the time — rather than about accuracy.
The coverage column is read next to the censoring column, never instead of it.

**What the long-span cells cost to obtain.** The model has no mean reversion, so over a year
its own simulated weights spread far enough that some draws reach zero, which `Observation`
refuses; those replicates are drawn again from a separate seed block. Overall that is 32 of
1,050, about 3% — but reporting only the 3% would be misleading, because the redraws are not
spread across the grid. Every one falls in a long-span cell: 12%, 16% and 14% in the three
365-day cells, 5.5% in the 299-day daily cell, and none at all in the other eight. The
365-day cells are exactly the ones carrying the headline result above.

The selection runs in the conservative direction for that result. A draw is rejected for
wandering to a non-positive weight, which is what a *large* realised process noise does, so
the series that survive carry systematically smaller realised drift — less signal about
`sigma_accel`, not more. Conditioning on physical possibility can therefore only understate
how well a year of data identifies trend flexibility, and the qualitative conclusion of this
section survives it. The rate is reported per cell in [results.md](results.md) rather than
folded into one number.

## E4 — what a fitted parameter would actually look like

On daily data, measurement noise recovers well: bias indistinguishable from zero by 120
readings, median estimate within 0.3% of truth at 300.

Process-noise intensity does not. At 30 daily readings the median estimate is *at the floor
of the search space* — 54% of replicates land there, and the median ratio to truth rounds to
zero. The bias is −1.95 in orders of magnitude, meaning a typical estimate about ninety
times too small. By 120 readings the bias is −0.14 (about 28% too small) and by 300 it is
−0.026 (about 6%), so the estimator is consistent; it is just very slow, for the reason E3
explains.

**The direct consequence, and its exact scope.** A per-user maximum-likelihood fit, on the
amount of data a real user has after a month, would not estimate the trend flexibility — it
would report the shape of its own search space, and would do so with an air of having
measured something. So the supported conclusion is this one and no wider: **per-user,
per-request fitting on roughly a month of history is not supported by this evidence, and the
fixed documented priors remain the appropriate production default for now.** The
architectural decision to give goals and parameters no route into the core turns out to have
a statistical justification for that case as well as a privacy one.

What this is *not* is a finding that the shipped values are right, or that no fitting could
ever help. E5 fits the same two parameters *pooled* over a training split of 30 series drawn
from a known regime, and that fitted filter beats the shipped priors on the 30-day metric in
five of eight regimes, and by more than three-fold on `irregular` and on `outliers`. Pooled
fitting against a known regime and per-user fitting on a month of history are different
questions; M6 answers only the second, and answers it in the negative.

### sigma_v0, the prior with no principled source

ADR-0003 flagged `sigma_v0` as "a judgement call that visibly affects early-data behaviour,
and it is unvalidated", and deferred the sweep to this milestone. The sweep holds it at half,
one and twice the shipped value: a factor of two either way from nominal, and a factor of
four across the full range. Each row below runs across that full range, smallest `sigma_v0`
first:

| readings | weekly-rate interval width, kg | 30-day forecast interval width, kg |
|---|---|---|
| 2 | 1.96 → 3.85 → 7.27 | 9.2 → 17.1 → 31.9 |
| 5 | 1.83 → 2.93 → 3.81 | 8.9 → 13.7 → 17.7 |
| 10 | 1.29 → 1.47 → 1.54 | 7.0 → 7.8 → 8.1 |
| 30 | 0.726 → 0.726 → 0.726 | 4.78 → 4.78 → 4.78 |

ADR-0003 was right, and now bounded. With two readings the reported uncertainty is
essentially the prior: across the full four-fold range, half the shipped `sigma_v0` to twice
it, the reported weekly-rate interval moves by a factor of 3.7. Across that same four-fold
range it is a 19% effect by ten readings and a 0.03% one by thirty — the data has completely
overwritten the prior.

So the honest characterisation is: `sigma_v0` is a consequential choice for a user's first
week and an irrelevant one thereafter. It is not validated by this — nothing here says the
shipped value is *right*, only that being wrong about it stops mattering quickly. (This is
also why the sweep was extended below 30 readings during implementation. Run only at 30, it
would have shown no sensitivity and supported the false conclusion that the prior does not
matter.)

## E5 — the estimator does not win everywhere

Eight regimes, six methods, two metrics. Every baseline was *tuned* — window or time
constant chosen by grid search on a disjoint training split from the same regime, and the
fitted Kalman given its two parameters by maximum likelihood on that split. The shipped
estimator got the documented priors and no tuning at all. The comparison is therefore
deliberately generous to the baselines, and both directions of that need saying: where the
shipped estimator wins it wins against methods handed an advantage no deployment could give
them, and where it loses the margin is an upper bound on what an untuned baseline would
manage.

Of 80 comparisons the shipped estimator was beaten in 31, of which 20 were by methods that
are not Kalman filters at all.

**Where it wins.** On the model-correct regime, as it must — 30-day forecast error 1.00 kg
against 3.9–4.1 kg for every level-only method, which is simply the cost of forecasting flat
when there is a trend. And on smooth curvature, where it is the best method tested (0.51 kg
against 0.64 for Holt and 0.80 for a moving average): a locally linear trend tracks a
continuously bending one better than anything without a trend term.

**Where it loses, and this is the finding worth carrying forward.** On the 30-day metric —
the horizon the product actually claims — the shipped estimator is beaten in six of the eight
regimes by a tuned Holt, and in five of the eight by a Kalman filter whose two parameters
were fitted on a disjoint training split from the same regime. Stated in full rather than by
its two most striking rows:

| regime | shipped | tuned Holt | fitted Kalman | best of the six |
|---|---|---|---|---|
| `model_correct` | 1.002 | 1.074, worse | 1.003, unclear | shipped, 1.002 |
| `curvature` | 0.513 | 0.640, worse | 0.552, worse | shipped, 0.513 |
| `flat` | 0.477 | 0.083, **better** | 0.157, **better** | moving average, 0.070 |
| `plateau` | 1.108 | 1.059, **better** | 1.131, worse | EWMA, 0.183 |
| `steady_loss` | 0.460 | 0.341, **better** | 0.167, **better** | fitted Kalman, 0.167 |
| `jump` | 2.332 | 1.785, **better** | 1.762, **better** | fitted Kalman, 1.762 |
| `irregular` | 0.602 | 0.364, **better** | 0.181, **better** | fitted Kalman, 0.181 |
| `outliers` | 0.783 | 0.439, **better** | 0.223, **better** | fitted Kalman, 0.223 |

Mean absolute error in kg against the latent truth; *better* and *worse* mean the paired 95%
interval on the per-series difference lies entirely below or above zero.

Two things that table is not permitted to hide. **`steady_loss` is in it** — the regime
that is simply a constant rate through noise, not one constructed to be adversarial. There a
tuned Holt cuts the 30-day error from 0.46 kg to 0.34 kg, and the fitted Kalman to 0.17 kg.
And **the fitted Kalman materially beats the shipped priors in five regimes**, by more than
three-fold on `irregular` (0.18 kg against 0.60) and on `outliers` (0.22 kg against 0.78).
That second one is a result about parameter values, not about model form: same filter, same
equations, two different numbers.
It is the counterweight to E4, and the scope paragraph in that section says what the two of
them jointly support.

What survives all of that is that **no method wins uniformly** — the shipped estimator
included, and no challenger either. Shipped is the best of the six on `model_correct` and on
`curvature`; a moving average is best on `flat`, an EWMA on `plateau`, the fitted Kalman on
the remaining four. Every beating above was administered by a method tuned on the exact shape
it was then tested on, which no deployment could arrange. There is no ranking in this table
that holds across all eight regimes, and the honest reading is that method choice here is
regime choice.

`flat` and `plateau` have the same cause. When the true trajectory has no trend, or has
stopped having one, the filter's velocity estimate is mostly noise — and the 30-day forecast
multiplies that noise by thirty days. A moving average, which cannot represent a trend at
all, is right for exactly the reason it looks unsophisticated. On a plateau the filter
additionally has to *unlearn* the trend that preceded it, which the process-noise prior only
permits slowly; `docs/mathematics.md` section 8.6 predicted this qualitatively, and the
number is 6×.

**Interval coverage under misspecification.** This is where the cost of a wrong model shows
up as something other than a slightly larger error.

| regime | one-step coverage | 30-day coverage |
|---|---|---|
| model-correct | 95.0% | 94.3% |
| jump | 90.7% | **48.0%** |
| outliers | 87.7% | 94.3% |
| flat / steady loss / curvature | 95.3–95.5% | 100% |

On a genuine 2.5 kg level shift the 30-day interval contains the truth less than half the
time. On 5% contaminated readings the one-step interval is 88% rather than 95% — the outlier
sensitivity ADR-0004 and `docs/mathematics.md` section 8.3 describe, now expressed as a
coverage number. And on the deterministic regimes the intervals over-cover at 100%: they are
sized for a model with process noise, and those trajectories have none, so they are too wide
rather than too narrow. Over-wide intervals are the safer failure, but they are still not
calibrated.

**Holt.** Pre-registered before the results were computed, in the module that implements it:
on a regular grid, linear exponential smoothing is the steady-state form of exactly this
local-linear-trend model, so near-identical one-step accuracy between tuned Holt and a fitted
Kalman is a mathematical identity and not a finding. That is what happened — one-step MAE
0.4433 against 0.4365 on the model-correct regime. Where they separate is where the theory
says they should: on the irregular schedule (30-day error 0.36 for Holt against 0.18 for the
fitted filter), and in the fact that Holt has no covariance and therefore states no interval
at all.

**Multiplicity.** The 80 comparisons each carry their own unadjusted 95% interval, so even
with no true difference anywhere, roughly four of them would be expected to exclude zero.
Nothing in this section is offered as multiplicity-adjusted confirmatory inference, and the
verdicts that turn on a few thousandths of a kilogram of one-step error should be read with
that in mind. What the section actually rests on are the large effects — six- and seven-fold
ratios on the 30-day metric, a threefold gap between the fitted and the shipped filter,
coverage of 48% against a nominal 95% — none of which sits near the boundary any adjustment
would move.

**No interval was invented for the methods that do not have one.** LOCF, moving average,
EWMA and Holt produce point predictions with no error model. The coverage table has two rows
rather than six, which is an honest gap in the comparison rather than a filled-in one.

---

## What this milestone does and does not license saying

**Now supportable:**

- the log-likelihood and forecast moments are arithmetically correct: the two recursions
  agree to `2.1e-14` across all 810 battery cases; an independent computation adjudicated
  781 of them and agreed to better than `1e-8`; the other 29 are ill conditioned for that
  computation, and a 60-digit exact-arithmetic spot check kept as a permanent test supports
  the diagnosis that the float64 oracle, not the filter, is the party losing accuracy there
- on synthetic data drawn from the model's own assumptions, the 95% intervals cover about
  95% of the time, for latent weight and for velocity, on regular and irregular schedules,
  over 500 series in each of the two configurations
- irregular weigh-in spacing costs no calibration, as the process-noise construction claimed
- the process-noise parameter is not identifiable from a month of data at any weighing
  frequency, which is a measured argument against per-user parameter fitting
- the initial-velocity prior materially affects the reported uncertainty for roughly the
  first ten readings and is negligible by thirty
- the estimator has been compared against four simpler methods and a fitted variant of
  itself across eight regimes, and is not uniformly better than them: on the 30-day metric a
  tuned Holt beats it in six of eight regimes, a Kalman fitted to the regime in five, and a
  moving average or EWMA in two. No method in the comparison wins everywhere either.

**Still not supportable, and unchanged by this milestone:**

- anything about real weight data. No real health data has been used for any evaluation.
- that the model is the right model. E2 validates the implementation against the model; E5
  shows several regimes where the model is the wrong one and simpler methods do better.
- that the intervals are calibrated in general. They are calibrated when the model holds and
  demonstrably are not when it does not — 48% coverage on a level jump.
- that the shipped parameter values are correct. They are documented priors. E4 shows that
  fitting them per user on a month of history would be worse, which is not the same as
  showing they are right — and E5 shows that fitting them to a regime, pooled over a
  training split, can be materially better.
- any classification, probability or threshold the backend does not compute. Nothing here
  adds one.

## Limitations of the evaluation itself

- **Synthetic only.** Every regime is a guess about what real weight trajectories look like.
  The regimes were chosen to be adversarial in different ways, but a regime nobody thought
  of is not covered.
- **The truth is fixed within a regime**; only measurement noise varies across series. That
  makes the paired comparisons sharp, and it means the per-regime tuning is generous to the
  baselines — they were tuned on the exact shape they were then tested on, with only the
  noise differing.
- **Long-span cells are conditioned on remaining physically possible.** The model has no
  mean reversion, so over a year its own simulated weights spread by about 33 kg and some
  draws reach zero, which `Observation` refuses. 32 of 1,050 replicates were redrawn — about
  3% overall, but concentrated rather than spread: 12%, 16% and 14% in the three 365-day
  cells, 5.5% in the 299-day daily cell, and none in the other eight. The 365-day cells are
  the ones carrying E3's headline. The selection is in the direction of smaller realised
  process noise, which is conservative for identifying `sigma_accel`, so the qualitative
  conclusion survives it; the rate is recorded per cell in results.md rather than hidden.
- **`q = 0` is approximated** by the bottom of the search space, `1e-6`, whose contribution
  to the state covariance over a year is about five orders of magnitude below the
  measurement variance.
- **Two grid cells nearly coincide** (30-day span at 30 readings, and the 29-day daily
  diagonal). Harmless duplication, not a separate measurement.
- **E5's 80 comparisons are unadjusted for multiplicity.** Each carries its own 95%
  interval, so about four false positives are expected under no true difference at all. The
  large effects the section relies on are not near that boundary, but the marginal verdicts
  are not confirmatory inference.
- **Determinism is claimed for the same machine.** NumPy's generator streams are stable
  across platforms; the order and rounding of floating-point reductions is not. Committed
  results are rounded to six significant digits, which absorbs the difference.

## What this suggests next, without doing any of it

None of these is authorised by this milestone; they are what the evidence points at.

- **A robust observation model.** The outlier coverage number (88% one-step) quantifies what
  `Observation.obs_variance` was reserved for.
- **Mean reversion, or an explicit horizon limit.** The 100% coverage on deterministic
  regimes and the 33 kg year-long spread are the same fact seen twice: the model is honest
  about being locally valid, and the forecast horizon is what keeps that honesty cheap.
- **The level-jitter term ADR-0002 deferred.** E3's machinery is exactly what would decide
  whether it is distinguishable from measurement noise — and E3's answer about identifiability
  suggests the honest answer may be "not from a month of data".
- **Real-data evaluation**, which would need its own privacy design and would change the
  claims ledger. Nothing in M6 approaches it.

## Reproducing this

From `backend/`:

```bash
uv run python -m evaluation.run all       # ~20 minutes, writes evaluation/results/*.json
uv run python -m evaluation.run tables    # regenerates results.md from those files
uv run python -m evaluation.run all --smoke   # seconds; structurally complete, statistically empty
```

The test suite runs the smoke scale on every push. The full studies are deliberately not
tests: they take too long, and their output is committed evidence rather than a pass or a
fail. Two guards keep the chain honest instead. Test `EV10` ties the committed files to the
current priors and seed blocks, so a change to a documented prior invalidates the evidence
loudly instead of leaving a stale file that still looks authoritative. Test `EV11` re-renders
[results.md](results.md) from those files and fails on any difference, so the tables cannot
drift from the numbers they claim to report — whether by an edit to the markdown or by a
rerun nobody regenerated after.

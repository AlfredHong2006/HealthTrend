# ADR-0011 — The M6 evaluation harness: where it lives, what it may fit, and how it reports

**Status:** accepted, Milestone 6
**Extends:** [ADR-0002](ADR-0002-process-noise-and-irregular-dt.md) and
[ADR-0003](ADR-0003-initialization.md), both of which deferred questions to "the evaluation
milestone"; and the purity and layering rules established in
[ADR-0001](ADR-0001-state-and-units.md) and enforced by `tests/test_layering.py`

## Context

Five documents deferred work to a milestone that did not exist yet. ADR-0002 left open whether a
level-jitter term is distinguishable from measurement noise. ADR-0003 left `sigma_v0` as "a
judgement call that visibly affects early-data behaviour, and it is unvalidated", with a sensitivity
sweep deferred. `docs/mathematics.md` section 8 stated that calibration had been demonstrated only
on data drawn from the model itself, and that this "validates the implementation, not the model
choice". `architecture.md` reserved two directory names for the work. `docs/privacy.md` ended its
claims section with "do not describe the system as validated, robust, or accurate until there are
experiments that say so."

Milestone 6 runs the experiments. This ADR records the decisions that shaped how, several of which
were made or corrected during implementation rather than in the first design.

---

## 1. The harness is a sibling of `app/`, not a package inside it

### Decision

`backend/evaluation/` — a top-level package alongside `app/` and `testing/`, importable through the
existing `pythonpath = ["."]`. It may import `app.core` and `testing` and nothing else from the
project. Two new rules in `tests/test_layering.py` enforce this: no module under `app/` may import
`evaluation`, and no module under `evaluation/` may import a web framework or any layer above
`app.core`.

### Why not `app/evaluation/`, the name that was reserved

Because it cannot work. `architecture.md` reserved `app/evaluation/`, but everything under `app/` is
forbidden from importing `testing` — and `testing/synthetic.py` is where the generators live that
carry a hidden trajectory alongside their observations. An evaluation harness inside `app/` could
not use the very generators `architecture.md`'s own "where later work attaches" table named as the
attachment point for "baselines, calibration study".

The alternatives were to duplicate the generators into `app/`, which ADR-0007 already rejected once
for the demo package and which would leave two definitions of ground truth to drift apart; or to
relax the `testing` ban, which is load-bearing for the reason its docstring gives — shipping a
package named `testing` in a deployment artefact is indefensible. A sibling package needs neither.

The reserved name `app/evaluation/` is released and `experiments/` retired;
`architecture.md` is updated to say so.

### Cost

A new package that the layering tests did not previously cover, so the coverage had to be written
rather than inherited. That is the work of one parametrised scan, and it buys a guarantee that would
otherwise have been convention.

---

## 2. CI type-checks everything in `pyproject`, not just `app`

### Decision

The workflow's type-check step becomes `uv run mypy` rather than `uv run mypy app`.

### Why

`pyproject.toml` has listed `files = ["app", "testing"]` since Milestone 1, but CI named `app`
explicitly, so `testing` was strict-checked only when somebody remembered to run the bare command
locally. Adding a third package would have extended that gap rather than closed it. This is a change
to a documented command, so it is recorded here and in `CLAUDE.md` rather than made quietly.

---

## 3. Fitting exists, and exists only here

### Decision

`evaluation/mle.py` fits `sigma_obs` and `sigma_accel` by maximum likelihood. `sigma_v0` is never
fitted. Nothing in `app/` can reach any of it, and the shipped priors are unchanged.

### Why fitting at all, given the product does not fit

Because the question "should the parameters be fitted?" cannot be answered without fitting them.
E3 and E4 exist to measure how well a fit would do, and the answer is the justification for not
shipping one: at 30 daily readings the process-noise estimate lands on the floor of its search space
in 54% of replicates, with a typical estimate about ninety times too small. A per-user maximum
likelihood fit on a month of data would report the shape of its own search space with an air of
having measured something.

So the architectural decision that goals and parameters have no route into the core — previously
justified on grounds of neutrality and privacy — now also has a statistical justification.

### Why `sigma_v0` is never fitted

One series realises one initial velocity. The spread of the distribution that velocity was drawn
from is not estimable from it, and an estimate whose sampling distribution has nothing to do with the
quantity named is worse than no estimate. It is swept as a sensitivity instead, which is what
ADR-0003 actually asked for.

---

## 4. The fitting objective is not the oracle, and both are checked

### Decision

Three implementations of the same log-likelihood coexist deliberately:

- `app.core.filter.run_filter` — the shipped recursion, `O(n)`.
- `evaluation.mle.innovations_loglik` — the same recursion on plain floats with no dataclass
  construction, about 66 times faster, and the only thing any fit optimises.
- `evaluation.exact_likelihood.direct_loglik` — an independent `O(n**3)` joint-Gaussian computation,
  used as an oracle and never as an objective.

E1 runs all three across 810 cases. The two recursions are compared on every one of them; the
oracle adjudicates the 781 whose condition number leaves it precision to spare, and the other 29 are
classified rather than counted either way. `objective_discrepancy` re-checks the two recursions at
every fitted optimum and the maximum is published in the results file.

### Why three

A second implementation of the same recursion would reproduce a mistake in it exactly, so the oracle
has to be a different computation to be worth anything. But the oracle allocates an `n`-by-`n` matrix
and factorises it, which is the wrong thing to run thousands of times inside an optimiser. The lean
recursion is the fast path, and it is only trustworthy because the oracle checks it.

### The correction this decision survived

The first full E1 run reported six failures. In every one the two recursions agreed with each other
to `1e-15` while both differed from the oracle by `3e-8`, at condition numbers above `5e9`.
Recomputing at 60 significant digits showed the filter accurate to `7.4e-13` and the double-precision
oracle wrong by `3.7e-5`.

So the criterion was wrong, not the code. E1 now applies an unconditional tolerance between the two
recursions and consults the oracle only where its condition number leaves it precision to spare.
This is recorded here because "we widened a tolerance and the test passed" and "we established by
exact arithmetic which computation was wrong" look identical in a diff and are not the same act. The
exact-arithmetic reference is kept as a permanent test (`EV1`) rather than left as an anecdote.

---

## 5. Interval construction and boundary testing are separate questions

### Decision

Profile-likelihood intervals for `sigma_accel` invert a two-sided test at the chi-square quantile
with one degree of freedom, 3.84. Whether the data can reject `sigma_accel = 0` uses 2.71, the 5%
point of the 50:50 mixture of a point mass at zero and a chi-square with one degree of freedom. Both
are reported, separately labelled.

### Why not one cutoff

They are different hypotheses. Interval coverage asks whether a value in the *interior* of the
parameter space is captured, which is the ordinary two-sided problem. "Is there any process noise
at all" puts the null on the *edge*, where the standard asymptotics do not hold and the correct
critical value is smaller. Using 3.84 for the boundary test would make it conservative and understate
how often the data can detect drift — which is exactly the quantity E3 is about.

### Censored endpoints are counted at the bound, never dropped

At short spans the profile frequently never crosses the threshold before reaching the bottom of the
search space. Those replicates are reported with the interval extending to the bound, and the
censoring rate is published alongside the coverage. Dropping them would condition coverage on the
replicates where estimation happened to work, which is the one thing a study of *when estimation
works* must not do. Counting them can only make coverage look better than it is, which is the
conservative direction, and the censoring rate lets a reader see how much of the coverage is real.

---

## 6. Series are the unit of inference

### Decision

Every diagnostic is averaged within a series first, and every interval is the ordinary Student-t
interval on the mean across series.

### Why

Consecutive posteriors within one trajectory describe overlapping information, and consecutive
innovations share the state that produced them. Pooling 30,000 posteriors from 500 series and
dividing by the square root of 30,000 counts 500 independent replications as 30,000.

How badly that understates the standard error is not one number, and E2's committed summaries say
so. Against the naive standard error pooling implies, the clustered one is 2.27 and 2.33 times
larger for latent-weight and velocity coverage on the daily configuration, 3.17 times larger for
ANEES, and 0.99 times — indistinguishable — for ANIS; on the irregular configuration the same four
ratios are 1.44, 1.66, 2.01 and 1.04. Three of the four statistics would have carried intervals
materially too narrow, by a factor that depends on the statistic and on the schedule, and the
fourth would have been unaffected. That the size of the error varies is precisely why the unit of
inference has to be argued from the structure of the data rather than chosen by looking at the
interval it produces. A calibration study whose own intervals are wrong is worse than no
calibration study.

No sandwich estimators and no bootstrap: the series really are independent replications, so the
ordinary interval over their means is already the right one.

### And the stop criterion is not "an interval missed"

Eight statistics are checked. Under a correct implementation the chance that at least one 95%
interval misses is about a third, so treating a single miss as proof of a defect would generate a
false alarm most times the study is run — and the natural response to a false alarm, looking harder
until something is found to change, is how a correct implementation gets quietly broken. The
criterion is a large deviation (four standard errors) or a coherent one (three of eight, or the same
statistic in the same direction in both configurations).

---

## 7. Results are committed, generated tables are generated, and staleness fails loudly

### Decision

`backend/evaluation/results/*.json` are committed, rounded to six significant digits with a
`_config` block recording the seed blocks and the model parameters in force.
`docs/evaluation/results.md` is generated from them and carries a do-not-edit header, like
`openapi.json`. `docs/evaluation/report.md` is written by hand and holds only interpretation. Test
`EV10` fails if a committed file's recorded parameters no longer match `ModelParams.default()`, and
test `EV11` re-renders `results.md` from the committed JSON and fails on any difference.

### Why commit results at all

A full run takes about twenty minutes, which does not belong on every push, and its output is
evidence rather than a pass or a fail. Committing it makes the evidence reviewable in a diff.
Committing it *without* a guard would let a future prior change leave a stale file that still looks
authoritative — so the guard is the price of the convenience, and `EV10` is it.

Generating `results.md` from those files buys the same convenience one level up and needs the same
price paid. The two silent failures are somebody editing the markdown instead of the source, and a
rerun changing a number that nobody re-rendered; both leave a document reporting figures the
committed evidence no longer contains. `EV11` re-renders in memory and compares, which is exactly
what CI already does to `openapi.json`, for exactly the same reason.

### Why rounding, and why pass criteria are computed first

Six significant digits is far more than any conclusion rests on and keeps a regenerated file from
churning in its last bits across platforms. Every pass, verdict and comparison is computed on the
unrounded values and stored as its own boolean, so rounding cannot change a conclusion. No timestamps
are written: a diff that says only "generated on a different day" carries no information.

---

## 8. No new dependencies

### Decision

Numpy only. The optimiser is a hand-written Nelder-Mead, the profile intervals are bisection, the
Student-t quantiles are computed by inverting the distribution function through the regularised
incomplete beta function, and there are no figures.

### Why not scipy

`AGENTS.md` treats a dependency addition as a decision rather than a convenience, `uv sync --locked`
means a new dependency is also a lockfile change, and nothing in E1–E5 needs one. The optimisation
problem is two-dimensional and the whole study runs in about twenty minutes.

### The one thing this decision nearly got wrong

The first draft hardcoded a table of Student-t quantiles instead of computing them. Two entries were
wrong in the sixth or seventh digit — invisible on inspection, and silently present in every interval
the study would have reported. Computing them costs about forty lines and is checked against the two
degrees of freedom that have elementary closed forms. A transcribed statistical constant fails
silently; that is the argument, and it generalises beyond this ADR.

---

## What this ADR does not decide

- **No production mathematics changes.** `app/core/**` and the `ModelParams` priors are byte-for-byte
  unchanged and the golden fixtures still match. E5 found regimes where simpler methods forecast
  better; acting on that is a separate decision with its own ADR.
- **No real-data evaluation.** It would need its own privacy design and would change the claims
  ledger in `docs/privacy.md`. Nothing here approaches it, and the line "no real health data has been
  used for any evaluation" remains true.
- **The level-jitter term of ADR-0002 stays deferred.** E3 built the machinery that would decide it;
  E3's own finding — that process-noise intensity is not identifiable from a month of data — suggests
  the answer may be that it is not distinguishable at realistic scales either. That is a question for
  a later milestone, with real data or a much longer span.

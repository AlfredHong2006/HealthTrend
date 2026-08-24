# ADR-0007 — Demo scenarios: owned by the application, anchored to now

**Status:** accepted, Milestone 2

## Context

A visitor should not need an iPhone, an Apple Health export or an account
to see what this product does. `GET /api/demo/{scenario}` exists to make that true.

Two questions had to be answered before writing a line of it: where the generators live, and
what date the data should carry.

---

## 1. `app/demo/` owns its generators; production never imports `testing/`

### Decision

`app/demo/scenarios.py` implements its own generation. `backend/testing/synthetic.py` is
untouched and remains test-support code for the numerical core.
`tests/test_layering.py` asserts that no module under `app/` imports the `testing` package.

### Why not reuse `testing/synthetic.py`

It is the obvious move and it is wrong for three reasons.

**It points the dependency the wrong way.** A deployment artefact containing a package named
`testing`, imported by the application at request time, is not defensible — and it is
precisely the kind of thing that is cheap to add and expensive to remove once a route relies
on it.

**The two need different data.** `testing/synthetic.py` holds fixtures chosen to pin
mathematical properties: noise-free linear ramps for recovery tests, model-consistent draws
for calibration. A demo needs plausible weights and the shapes a user would recognise — a
plateau, a reversal — none of which are in there. Adding them would mean editing a frozen
Milestone 1 module for a product reason.

**Their reasons to change differ.** Demo scenarios will be tuned for a better first
impression. The Milestone 1 fixtures must not move when that happens, because the golden
fixture depends on them.

### Cost, stated plainly

The piecewise-linear series construction now exists twice, in slightly different forms. That
is real duplication and it is the price of the separation. It is bounded — roughly thirty
lines — and the two are tested independently against different properties.

---

## 2. A scenario is generated backwards from the clock, not from a fixed date

### Decision

The most recent observation lands `_TRAILING_LAG_DAYS = 0.25` (six hours) before the injected
clock's `now`, and the rest of the series runs backwards from there. Seeds are fixed, so the
*shape* of a scenario never changes; only its dates move.

### Why this matters more than it looks

Forecast variance carries a `σ_a²τ³/3` term (`docs/mathematics.md` §6), where `τ` is the
total elapsed time from the last observation. A demo anchored to a fixed date accumulates
lead time as the calendar advances. Anchored to 2025-01-01 and served in mid-2026, `τ` is
roughly 600 days and the 30-day interval comes back tens of kilograms wide.

That would be *mathematically correct* — which is what makes it dangerous. Nothing would
fail. No test would break. The product would simply give a useless first impression, and the
mechanism would be invisible to anyone who had not read §6.

`tests/api/test_demo.py` pins both halves: every scenario's last observation is within a day
of the clock, and every scenario's 30-day band is between 0.2 kg and 8 kg wide.

### Why six hours rather than zero

Nobody steps on a scale at the instant a page loads, so a small lag is more honest. It also
means the demo exercises the non-zero-lead path of ADR-0005 rather than always hitting the
degenerate `λ = 0` case.

---

## 3. The demo returns the standard response shape

`DemoAnalysisResponse` extends `AnalysisResponse` with one `scenario` block carrying the
label, seed and generator arguments. The frontend milestone should need one renderer, not
two, and the demo should be the same product surface rather than a special case of it.

The provenance block deliberately names no Python module or function: an internal code path
is not a stable public identifier, and renaming a function must never be an API break. The
scenario id, the seed and the published arguments are the reproduction recipe; where the code
lives is this ADR's business, not the contract's.

Every scenario is labelled synthetic, and `DemoSeries.__post_init__` refuses to construct one
whose label does not say so — the same guard `testing.synthetic.SyntheticSeries` applies, for
the same reason (`docs/privacy.md`). `meta.source` is `"demo"` on every demo response —
meaning *this API generated the data*, which is the only provenance claim the server can make
truthfully; submitted data gets `"submitted"`, not a `synthetic: false` the server could never
verify. The catalogue declares itself synthetic as well.

---

## The five scenarios

| Id | What it demonstrates |
| --- | --- |
| `gradual-loss` | a steady trend under ordinary noise |
| `plateau` | loss that flattens — which a local-linear trend tracks with a visible lag |
| `reversal` | loss turning into gain, so the estimated velocity must change sign |
| `noisy` | a modest real trend buried in large fluctuation |
| `irregular` | twice-daily readings and three-week silences in one series |

The latent path is piecewise-constant in velocity and integrated, so it is continuous with no
jumps. `plateau` and `reversal` deliberately show the estimator lagging a turning point: that
is a true property of a local-linear-trend model (`docs/mathematics.md` §8.6), and a later
change-detection milestone addresses it. Showing it is more useful than hiding it.

`noisy` uses a measurement standard deviation of 1.0 kg, well above the estimator's own
`σ_obs` prior of 0.5 kg, so the filter is genuinely misspecified for that series and smooths
less than it ideally should. Also deliberate. The priors are unfitted (ADR-0003), and a demo
that only ever showed data matching them would be flattering rather than informative.

## Consequences

Good: the demo is a product feature with product tests; the numerical core and its fixtures
are untouched; scenarios can be retuned freely without moving either golden fixture; and the
package is usable from a script, because it holds no HTTP types.

Cost: about thirty lines of series-construction logic exist in two places, and the demo's
believability rests on hand-chosen parameters that nothing validates beyond the bounds in
`test_demo.py`.

Related: [ADR-0004](ADR-0004-multiple-observations-per-day.md),
[ADR-0006](ADR-0006-http-boundary.md)

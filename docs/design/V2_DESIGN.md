# HealthTrend V2 — Design Direction

The approved design direction for V2. Product intent lives in
[../product/V2_PRODUCT.md](../product/V2_PRODUCT.md); this document governs how it is expressed.

## Overall direction

**HealthTrend V2 = Annotated Canvas.**

A hybrid, deliberately combining four things:

| Element | Source direction |
| --- | --- |
| Persistent analytical canvas + synchronized analysis rail on desktop | **C** — architecture |
| Serious, instrument-style chart interaction | **A** — chart discipline |
| Editorial, conversational explanation and readable mathematics | **B** — communication |
| Mobile composition that does not force a permanently sticky ~45vh chart | **B-like** — mobile |

The visual identity draws on Apple's cleanliness, hierarchy and restraint; the seriousness of a
professional charting instrument (TradingView, IBKR); Bloomberg's analytical credibility; and
Oura-style interpretation.

What is borrowed from the trading instruments is **discipline** — precision, density, an axis-linked
readout, a chart that behaves like a measuring tool — not their aesthetic. HealthTrend must remain
distinctly itself: calm, precise and non-judgemental. It is not a terminal, not a dashboard, and not
a fitness app.

## Desktop

Roughly:

- **60–65%** chart / canvas
- **35–40%** analysis rail

The canvas should feel **open**, not boxed inside a dashboard card.

The analysis rail is **one continuous analytical surface**, separated by typography and hairlines.
**Never allow the rail to decay into a stack of SaaS cards.**

Chart and rail are synchronized: selecting a point, an event or a forecast region should eventually
focus the relevant information in both places.

## Mobile

Do not simply shrink the desktop split-pane. Prefer:

```
conclusion
→ key metrics
→ large chart
→ interpretation
→ changes / insights
→ deeper evidence
```

The chart remains central, but it does not permanently consume half the viewport. **Real-device
usability takes priority over conceptual symmetry with desktop.**

## Chart grammar

Eventually support, where each is mathematically available:

- quiet raw observations
- a dominant estimated trend
- an uncertainty band
- a visually distinct forecast
- a "now" divider
- the user's goal reference
- a right-edge trend-weight value flag
- restrained grid
- a precise crosshair with an axis-linked readout
- time ranges — 1M / 3M / 6M / 1Y / ALL
- meaningful checkpoint markers

Avoid large floating tooltip cards where an integrated readout can work better.

Marks whose mathematics does not exist yet — checkpoint markers above all — are simply **absent** from
the chart. They are not drawn greyed out, and they are not replaced by an "unknown" notice.

## Metrics

Do not default to a generic four-card dashboard. Use typography, spatial hierarchy and hairlines.

Today's raw scale reading is **secondary evidence**. The important interpretation is the estimated
trajectory — trend weight and current rate.

## Explanation and drill-down

The analysis interaction supports:

```
Conclusion
→ Why
→ Evidence
→ Statistics
→ Mathematics
```

Desktop may use a rail plus a detail stack. Mobile may use natural vertical disclosure or a dedicated
detail view.

The **mathematics tier prioritizes readability**: real equations, an explanation in words, what each
parameter means, the assumptions in force, and code provenance where appropriate. Do not squeeze
equations into a cramped, terminal-like panel. The reference material already exists in
[../mathematics.md](../mathematics.md) — including the equation-to-code index — and the product tier
should feel like that document, rendered well.

## Typography and density

- **Canvas** — airy, premium, restrained.
- **Analysis** — more information-dense, still readable.
- **Mathematics** — editorial and scientific readability.

Use **tabular numerals** for every quantitative value, so numbers do not jitter as they update.

## Surface philosophy

Explicitly avoid:

- card grids
- excessive rounded rectangles
- generic admin-dashboard visual language
- gradients or glow used merely to look "AI"
- decorative metrics with no analytical purpose

The chart itself should provide much of the page's visual structure.

## Motion

Motion communicates continuity and selection:

- chart range transitions
- rail and detail transitions
- synchronized highlight states
- disclosure expansion

No decorative animation for its own sake.

## Light and dark

Both may eventually be first-class. Do not prematurely redesign around one theme unless a later,
explicit implementation decision chooses that.

## Honesty ledger

What the product may show is bounded by what the backend actually computes. This ledger is the
binding reference; it is not a wish list.

### Available today

From `POST /api/analyse` and `GET /api/demo/{scenario}`:

| Capability | Where it comes from |
| --- | --- |
| Raw observations, normalised to kg/UTC | `observations[]` — `timestamp`, `weight_kg` |
| Estimated trend line, one point per observation | `trajectory[]` — `w_kg` |
| Uncertainty band on the trend | `trajectory[]` — `w_sd`, `w_lower95`, `w_upper95` |
| Current trend weight and its interval | `current` — `w_kg`, `w_sd`, `w_lower95`, `w_upper95` |
| Current weekly rate and its uncertainty | `current` — `weekly_rate_kg`, `weekly_rate_sd_kg` |
| Analytic forecast at 7 / 30 / 90 days, with intervals | `forecast.horizons[]` |
| A daily forecast path out to 90 days, with a widening band | `forecast.path[]` |
| The "now" divider, and the lead since the last weigh-in | `forecast.origin_timestamp`, `last_observation_timestamp`, `lead_days` |
| Series extent | `n_obs`, `span_days` |
| Model parameters, echoed for transparency | `params` |
| What the numbers mean | `meta` — `source`, `filtered_not_smoothed`, `interval_describes` |

Time-range selection (1M / 3M / 6M / 1Y / ALL) is a client-side view over data already returned and
needs no new backend capability. Horizons are fixed at 7 / 30 / 90 and are not caller-selectable.

**Uncertainty may be shown; status may not.** The intervals and standard deviations above are
computed today and publishable today. A qualitative status or confidence label — "losing steadily",
"plateau", "high confidence" — is not a current API capability and must not be derived in the
frontend to compensate. Those stay future product concepts.

### Not available — do not display

There is **no** current support for:

- trend classification
- plateau detection or plateau probability
- change-point detection
- goal hitting-time / ETA
- a per-point rate series (the trajectory carries latent weight only; a weekly rate exists for the
  current estimate alone)
- outlier classification
- any other future insight intelligence

None of these may reach the interface in any form. Not as a fabricated output, and **not as an
"unknown / not enough evidence" state either** — that phrasing asserts an analysis ran and returned
nothing conclusive, which for an unimplemented capability is itself false. **Omit the capability
entirely.** A future interaction slot may be reserved in the design, but it stays non-user-visible
until the mathematics behind it exists.

"Unknown / not enough evidence" becomes a valid, designed product result at the moment a real
statistical capability evaluates the data and cannot support a conclusion — not before.

One boundary worth stating precisely: goal **distance** (a target against the current trend weight)
and a comparison of the backend-computed current rate against a user-supplied target rate are
transparent arithmetic over published numbers, and are allowed. A goal **ETA** is not — that needs a
hitting-time distribution the backend does not compute.

### Recorded internally, not exposed

Per-observation diagnostics are already computed and discarded at the wire boundary: `FilterStep`
carries the prior and posterior state, the innovation, its variance, the normalised innovation, the
Kalman gain and the log-likelihood contribution. These are the natural raw material for the
**Evidence** tier and may later be published through the backend.

That is a future decision requiring a schema change and an ADR, and it is **deferred**: the first V2
prototype uses the current API only. Until then the design may reserve space for it, nothing may
assume it, and no reserved space is user-visible.

## Goal state

Goals belong in the product. **Do not lock URL query parameters as the permanent persistence
architecture.** Persistent goals are decided alongside the future accounts and persistence milestone.

Prototype goal state is **synthetic or ephemeral only** — held in component state for the duration of
the visit. No `localStorage`, no URL-as-permanent-storage, no backend goal schema.

## Locked decisions for the first V2 prototype

Settled. Do not reopen these while prototyping.

- **No judgement colour.** Colour must not encode a generic good/bad health judgement — a
  maintenance user's flat rate is a success, not a warning. Distinct colours for distinct *series*
  and *events* are allowed (observations, trend, forecast, goal reference, a checkpoint): those
  identify what a mark **is**, not whether it is good news.
- **The prototype lives on its own isolated route.** It does not replace or modify
  `/demo/[scenario]` or `/analyse`.
- **The prototype brings its own V2 layout and shell.** Do not alter V1's global 760px shell or its
  shared tokens merely to prototype V2.
- **Goal state is synthetic or ephemeral**, as above.
- **`FilterStep` exposure is deferred.** The prototype uses the current API only, unchanged.
- **ADR and README updates are deferred** until a V2 direction is accepted for production.

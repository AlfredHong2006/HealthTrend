# HealthTrend V2 — Product Definition

The canonical statement of what HealthTrend is for. Design direction lives in
[../design/V2_DESIGN.md](../design/V2_DESIGN.md).

## North star

HealthTrend tells users **what their weight is actually doing despite noisy scale measurements, how
confidently we know it, what materially changed, and where their trajectory is heading.**

It is **not primarily a weight logger.** Logging is the cost of entry, not the value.

## Primary user

Someone trying to improve their shape or body composition — initially through weight loss or gain —
who already has measurements spanning weeks or months, and who periodically wants to know whether
they are genuinely progressing.

They do not need another place to type numbers. They need an answer they can trust about numbers
they already have.

The initial product is **weight-focused**. That is a starting scope, not a ceiling.

## Core product loop

```
data
→ trajectory
→ what changed
→ why
→ evidence
→ statistics
→ mathematics
```

Every layer is reachable from the one above it. The user chooses how deep to go; the product never
forces the whole depth on them, and never withholds it.

## Product principles

- **The estimated underlying weight matters more than today's raw reading.** A single scale number
  is evidence, not truth.
- **The current rate — kg/week — is one of the most important quantitative metrics in the product.**
  It answers "am I progressing" more directly than any weight value does.
- **Trend weight, rate, uncertainty and goal progress are surfaced clearly**, not buried under a log
  or a chart legend. Uncertainty here means the numeric interval the model computes. A *qualitative*
  status or confidence label — "losing steadily", "plateau", "high confidence" — is a future product
  concept and must not appear until it is mathematically defined and computed by the backend.
- **The default language is understandable and conversational.** A user should get a real answer in
  plain words before meeting a single symbol.
- **The deeper layers stay mathematically rigorous.** Simplifying the surface never means softening
  what is underneath.
- **Users must be able to inspect the real mathematics behind a conclusion** rather than being asked
  to trust the software. The ability to check the working is a product feature, not documentation.
- **The central chart is the primary product surface** — the main way conclusions are seen,
  interrogated and believed.
- **The user supplies a target weight, and optionally a target rate.** Goals are part of the product.
  Their persistence mechanism is deferred (see [Goals](#goals)).
- **Significant checkpoints are a future capability, gated on statistics.** Candidates: trend
  established, meaningful acceleration or deceleration, plateau, reversal, trajectory resumed. Each
  ships only once it is statistically supported.
- **Never show a fake classification, probability, plateau claim or goal ETA before the underlying
  mathematics exists.** This is a hard product rule, not a stylistic preference.
- **An unimplemented capability is absent, not uncertain.** If plateau or change-point detection does
  not exist, the product shows nothing for it — no marker, no label, no "unknown" state. Saying "not
  enough evidence" tells the user an analysis ran and declined to conclude, which for a capability
  that does not exist is itself a false claim.
- **"Unknown / not enough evidence" is a valid designed result — once the capability exists.** When a
  real statistical capability evaluates the data and cannot support a conclusion, saying so plainly
  is a first-class output with a real designed appearance, not an empty state or a spinner. It is the
  honest answer from a working analysis, never a placeholder for an absent one.

## Progressive disclosure

```
Conclusion
→ Why
→ Evidence
→ Statistical detail
→ Mathematics
```

The conclusion is what most users read. The tiers below it exist for the user who wants to check, and
for the moment a user stops believing the conclusion — which is exactly when the product has to be
able to show its working.

## Goals

Goals belong in the product: a target weight, optionally a target rate, and progress against them.

What is **not** decided: how goal state persists. URL query parameters must not be locked in as the
permanent persistence architecture. For prototypes, synthetic or ephemeral goal state is acceptable.
Persistent goals are decided alongside the future accounts and persistence milestone.

Note the standing architectural constraint: the estimator is structurally goal-neutral — a goal can
never reach the model. Goals are interpreted above the numerical core, never inside it.

## Explicit non-goals for V2

HealthTrend does not become:

- a generic AI coach or chatbot
- a calorie diary
- a meal logger
- a workout logger
- a streak, badge or gamification system
- a motivational wellness app
- a generic all-in-one fitness dashboard

## Deferred — future, not V2

Not rejected. Deferred until the core HealthTrend loop is exceptional:

- accounts and persistent history
- Apple Health
- Samsung Health / Health Connect
- smart-scale integrations
- Strava and contextual activity
- nutrition context
- body-composition and photo vision
- broader personalised guidance

The order of work is deliberate: breadth is worth nothing while the central answer — *what is my
weight actually doing, and how sure are we* — is merely adequate.

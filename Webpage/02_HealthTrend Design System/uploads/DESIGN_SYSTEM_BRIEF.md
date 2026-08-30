# HealthTrend — Visual Design System Brief

**Status:** Approved. Source material for design system generation.

The attached reference screenshots are inspiration and evidence of taste, not templates.

Scope of this stage: **the visual design system only.** Do not design final application screens.
Do not invent product functionality. Do not reproduce any reference literally.

The paste-in generation prompt is in Appendix A.

---

# 1. Product context

HealthTrend is a consumer health analytics product. It estimates an underlying weight trajectory
from noisy day-to-day measurements and communicates:

- estimated underlying / trend weight
- current rate of change
- uncertainty
- probabilistic forecasts
- goal context
- the evidence and statistics behind its conclusions

The core idea:

> Understand what your weight is actually doing beneath the noise, how confidently we know it,
> and where the current trajectory is heading.

It should feel calm, elegant, premium, trustworthy, precise, understandable, mathematically
credible, non-judgemental and consumer-first.

It should not feel like a generic weight logger, fitness dashboard, financial terminal or AI
product.

---

# 2. Core visual thesis

The central challenge is the difference between **clean** and **basic**.

A design is **basic** when restraint only removes things: fewer elements, weaker differences,
empty white space, generic type, generic cards, no hierarchy, no point of view.

A design is **elegant** when removing things makes what remains more intentional.

> **Restraint with deliberate hierarchy and visual authorship.**

In practice:

- The most important number has genuinely strong scale contrast — not one heading size up from
  body text.
- Space is deliberately composed, not leftover margin.
- Very few visible containers.
- Grouping comes from alignment, proximity, typography and subtle dividers.
- The chart is a hero object, not one dashboard card among many.
- Important metrics have individual visual presence rather than appearing as equal tiles.
- Typography carries much of the interface's identity.
- Colour is restrained and intentional.
- Motion connects ideas and states rather than decorating them.
- Axis labels, grid lines, line weights, focus states and spacing all feel deliberately designed.

Premium quality comes from **typography, proportion, spacing, data visualisation, composition and
motion** — not from decoration, cards, gradients or effects.

---

# 3. Inspiration references

## 01 — MacroFactor: rate and trend

**TAKE** — Rate treated as an important metric. Trend matters more than individual noisy scale
measurements. Clear distinction between measured weight and underlying progress.

**DON'T TAKE** — Too much happening at once. Too many competing metrics. Visually dense. Too many
simultaneous controls.

**WHY** — Confirms rate is information users genuinely care about. HealthTrend should say it far
more calmly. The user should not have to parse a whole dashboard to see whether their trajectory
is changing.

---

## 02 — MacroFactor

**TAKE** — Understandable presentation of weight progress. Sensible functional conventions.

**DON'T TAKE** — Too generic. Not enough distinctive identity. More functional than elegant.

**WHY** — A functional and competitive reference, not an aesthetic target.

---

## 03 — Oura dashboard

**TAKE** — Calm, approachable presentation of complicated information. Strong hierarchy. Good
spacing around important numbers.

**DON'T TAKE** — Information still competes on the same screen in some states. Too much white in
places. Can feel flat.

**WHY** — Borrow Oura's ability to make sophisticated health information understandable, but with
stronger hierarchy, fewer simultaneous ideas, and more visual authorship.

---

## 04 — Oura tiles

**TAKE** — Grouping is immediately understandable. Fast to scan.

**DON'T TAKE** — The tiles themselves read as basic. Do not become a grid of rounded health cards.

**WHY** — Borrow the grouping *logic*, not the visible containers. Establish grouping through
spacing, alignment and typography rather than drawing a rectangle around every concept. This is a
major part of the distance between clean and basic.

---

## 05 — TradingView

**TAKE** — Excellent chart visual language. Precise plotting on a light background. Strong axis
design and crosshair interaction. Restrained data colours. Instrument-quality feel.

**DON'T TAKE** — Far too much visual complexity. Too many controls. Terminal density. Intimidating
for ordinary consumers.

**WHY** — The trajectory chart should feel like a serious analytical instrument. Everything around
it should be considerably calmer.

> Target: **TradingView-level precision with Apple/Oura-level restraint.**

---

## 06 — Bloomberg

**TAKE** — Analytical seriousness. Data feels credible and consequential.

**DON'T TAKE** — Too utilitarian, too dense, too terminal-like.

**WHY** — Borrow the seriousness, not the appearance.

---

## 07 — Apple product page: scroll and continuity

**TAKE** — Smooth scroll feeling. Continuity between sections. One idea introduced at a time.
Exceptional hierarchy and spacing. Large visual moments. Motion connecting one idea to the next.
The sense of discovering the product while moving down the page.

The premium feeling comes from composition, typography, scale, spacing and transition — not from
boxes or decoration.

**DON'T TAKE** — HealthTrend is used repeatedly. It must never require a cinematic sequence on
every visit, scroll-jacking, mandatory animation, or scrolling before the user sees their answer.

**WHY** — Apple's interaction language is inspiration for how HealthTrend progressively deepens
understanding. It should not literally become a marketing page.

---

## 08 — Apple landing page: progressive statistics

**TAKE** — Very strong initial hero. Major information immediately available. Deeper information
revealed on scroll. Large numbers given real visual space. Statistics feel important rather than
appearing as small dashboard tiles. Sections feel like one connected composition.

**PRINCIPLE** — The product becomes deeper as the user chooses to explore it, following
**conclusion → explanation → evidence → statistics → Method**. Exact section boundaries are not
prescribed.

---

## 09 — Apple Health

Useful primarily as a **negative control.**

**DON'T TAKE** — Too basic. Not enough character or authorship. Feels like a container displaying
health numbers rather than an experience making an argument about them.

**WHY** — This matters because Apple Health and Apple's product pages come from the same company
using the same design language, and one feels basic while the other feels premium. The difference
is not font, colour or corner radius. It is editorial and compositional judgment.

Apple Health presents data. Apple's best pages make an argument about what matters, what the user
should notice first, what comes next, and how the pieces relate.

HealthTrend has an argument:

> Here is what your underlying trajectory is actually doing beneath noisy measurements, and here
> is why we believe it.

The visual design must communicate that argument rather than simply present numbers. **If the
output presents numbers without an editorial position, it will land as 09 no matter how good the
typography is.**

---

## 10 — Distill: scientific explanation

**TAKE** — Difficult ideas presented deliberately. Prose, diagrams and technical material coexist
cleanly. Generous spacing. Clear progression through an explanation. Scientific credibility
without a developer aesthetic.

**DON'T TAKE** — Do not make HealthTrend look like a research paper. Do not make the consumer
application academically dense. No research styling for the sake of appearing intellectual.

**WHY** — Method is a separate experience explaining what the system estimates and why. Distill
shows how sophisticated technical ideas can be communicated beautifully.

---

## 11 — Distill: mathematical presentation

**TAKE** — Beautiful equation presentation. Notation as part of the composition rather than pasted
into it. Generous space around equations. Excellent relationship between prose and mathematics.
Rigor without clutter.

**DON'T TAKE** — Research-paper density. Documentation appearance. Anything that makes ordinary
users feel they need a mathematics degree.

**WHY** — The Mathematical Appendix should feel like a premium part of the product, not repository
documentation rendered in a browser.

---

# 4. Resolved architecture decisions

## 4.1 Primary desktop architecture

HealthTrend retains its **chart + analysis rail** architecture. The primary surface must
immediately give a returning user the estimated underlying weight, current rate, trajectory and a
concise interpretation, without scrolling through a story first. The chart remains the dominant
visual object.

## 4.2 Progressive scrolling is a secondary layer

Apple-inspired progressive reveal supplements the application architecture; it does not replace
it. Below and around the main analytical surface, HealthTrend may use spacious transitions,
progressive disclosure, large statistics, scroll-triggered composition changes and restrained
animation — using information HealthTrend already has.

There must be no scroll-jacking, no mandatory cinematic introduction, no intentionally delayed
information, no animation the user must wait for, and no important metric hidden solely because
the user has not scrolled.

## 4.3 Why / Evidence / Statistics

There is **one home** for the deeper analysis.

The scrolling experience may contain a spacious **Inspect analysis** section, but:

> The scroll section is a route into the deeper analysis, not a duplicate copy of it.

Selecting Inspect analysis enters the existing deeper state, where Why, Evidence and Statistics
remain available **one tier at a time**.

**Main analysis → Inspect analysis → Why / Evidence / Statistics**

Do not duplicate that content inside the scrolling page.

## 4.4 Method

Method remains a separate destination with a different job.

- **Analysis asks:** what does HealthTrend say about my data?
- **Method asks:** how does HealthTrend calculate and justify this?

The main experience should not become overloaded with equations. Method can progress from
intuitive explanation toward mathematical rigor.

---

# 5. Mobile direction

**There is no positive mobile reference in this set.** Do not treat Apple Health as the mobile
authority simply because it is the only mobile-native Apple reference. Derive mobile from the
approved HealthTrend system instead.

Desktop should not collapse into a stack of identical cards. Information hierarchy:

**Conclusion → key metrics → trajectory chart → interpretation → deeper analysis**

Requirements:

- The chart remains important and receives substantial vertical space.
- Deliberately composed for touch.
- Important numbers remain visually dominant.
- Information unfolds naturally downward.
- The chart scrolls normally rather than permanently occupying half the viewport.
- Avoid tiny charts, card overload, and many equal-priority metrics.
- Do not recreate the desktop rail as a long stack of boxes.

Mobile should feel like the same product, not a different design language.

---

# 6. Colour mode

**V2 is light-mode first and light-mode only.** Do not produce a parallel dark mode. This lets the
system optimise typography, surfaces, data colours, uncertainty treatment, contrast, chart
legibility and interaction states for the strongest possible light experience.

Light mode should feel refined, calm, dimensional and soft where appropriate — not sterile, empty
or uniformly pure white. Subtle tonal surfaces are welcome where they improve hierarchy.

---

# 7. Colour philosophy

HealthTrend uses **one primary saturated accent family**, preferably a refined cool blue /
blue-azure. Not purple, neon, AI gradients or rainbow palettes. Do not choose colour merely
because it reads as technological.

## Data hierarchy

The **estimated trajectory line** carries the strongest saturated data colour in the interface.
Everything else is subordinate.

- **Raw measurements** — quieter, neutral or low-chroma; visible but clearly secondary to the
  inferred trajectory.
- **Uncertainty** — visually related to the trajectory, softer, subordinate; communicates
  uncertainty without overwhelming the line.
- **Forecast** — clearly distinguishable from observed-history inference, from the same visual
  family, and should feel probabilistic rather than like a guaranteed future.
- **Goal** — identifiable but must not compete with the estimated trajectory.

## No moral colour

Colour encodes **data roles**, not judgement. No green-good / red-bad for weight or goal outcomes.
A maintenance trajectory may be exactly what the user wants.

---

# 8. Information hierarchy

**The chart is the visual hero.** It is HealthTrend's signature analytical object and should have
enough space and authority to define the composition of the page. It should not look like a
generic dashboard widget.

**Current rate is a hero metric.** It should not be buried among secondary statistics.

Establish strong hierarchy between estimated underlying weight, current rate, concise
interpretation and the chart — without letting all four compete equally.

**One primary idea per visual region.** Avoid showing every possible metric simultaneously. Each
region should have a clear editorial purpose and continuously answer: what matters most here?

---

# 9. Data visualisation principles

> TradingView-level precision with Apple/Oura-level restraint.

Define the visual role of:

- raw measurements
- estimated trajectory
- uncertainty band
- forecast
- forecast uncertainty
- goal reference
- current-value indicator
- historical / forecast boundary
- axes
- grid
- crosshair
- tooltip / inspection readout
- range controls where applicable

Qualities: precise, calm, legible, trustworthy, interactive, not intimidating.

Avoid terminal density, excessive chart furniture, dozens of controls, heavy grid lines, too many
colours, and complexity that only performs sophistication.

## Low-confidence and early states

HealthTrend's argument depends on stating confidence honestly, so the states where confidence is
low are first-class design cases, not edge cases. The system must define treatment for:

- **Insufficient data** — a new user with a handful of readings, where no trend can responsibly be
  estimated yet. This state should feel intentional and calm, not like an error or an empty
  dashboard.
- **Wide uncertainty** — enough data for an estimate, but a band wide enough that the trajectory
  claim is weak. The visual weight of the band relative to the line has to carry this honestly.
- **Stale data** — the user has not weighed in for a while and the estimate is ageing.
- **Conflicting or outlier readings** — how a clearly anomalous measurement is rendered without
  either hiding it or dramatising it.

A product that only looks good with clean data and a confident trend is not finished.

---

# 10. Motion philosophy

Motion should connect sections, communicate continuity, explain state change, guide attention and
make the product feel cohesive.

Likely areas: initial chart appearance, metric transitions, progressive scroll reveal, transition
into deeper analysis, detail-state changes, goal interaction, subtle focus and hover feedback.

Motion should be restrained, smooth, purposeful and premium. It must never delay information,
hijack scrolling, exist as decoration, frustrate repeat use, or require replaying a sequence.

Support reduced-motion behaviour in the eventual implementation.

---

# 11. Surfaces and containers

Avoid defaulting to cards. A visible container should exist because it solves a real hierarchy or
interaction problem, not because information needs a rectangle.

Prefer whitespace, alignment, typographic hierarchy, subtle tonal changes, hairlines and proximity
before reaching for borders, shadows and rounded boxes.

Rounded components are not forbidden. They simply should not become the visual language of the
whole product.

---

# 12. Typography

Typography is expected to carry a large part of HealthTrend's identity, so it needs real direction
rather than being left to default.

## Typeface direction

**This is an open decision requiring a small number of clearly differentiated options.**

Propose two or three directions, each with a rationale. Consider:

- A single family used across interface, long-form Method content and mathematics.
- A pairing — an interface face plus a text face with better long-form and scientific character.
- Whether hero metrics warrant a distinct display treatment from body text.

Do **not** default to a neutral modern grotesque simply because it is the safe contemporary
interface choice. That default is a significant contributor to the generic look this brief exists
to avoid. If a grotesque is genuinely right, argue for it specifically.

## Numerals

Numbers update in place throughout this product — metric readouts, crosshair values, table
columns, axis labels.

- Use **tabular lining figures** anywhere a value changes in place or aligns in a column, so
  digits do not shift horizontally on update.
- Proportional figures are acceptable in running prose.
- Specify whether hero metrics use the same numeral style; large figures sometimes read better
  proportionally, and this should be a decision rather than an accident.

## Precision and rounding

How many digits HealthTrend shows is a design decision, not an implementation detail. False
precision undermines the honesty the product is selling; too little precision hides the rate
signal. Define:

- decimal places for trend weight
- decimal places for rate, and its unit expression (per week, per fortnight)
- how uncertainty is expressed numerically alongside the estimate
- whether precision should reduce when confidence is low

## Scale and hierarchy

The system must support dramatic hero metrics, concise analytical conclusions, quiet metadata,
chart labels, navigation, body explanation, long-form Method content and mathematical notation.

Important numbers need meaningful scale contrast — not one conventional heading size larger than
their surroundings.

---

# 13. Units and locale

Define how the system handles:

- kg and lb, including the layout consequences of differing character counts in hero metrics
- date and time formats
- how units are rendered relative to the number (size, weight, colour, spacing)

Unit treatment is part of the hero metric composition, not a suffix appended to it.

---

# 14. Explicitly avoid

Generic SaaS dashboards. Grids of rounded cards. Excessive rounded rectangles. Generic health-app
styling. Purple-and-black AI aesthetics. Decorative gradients. Glow. Bento-grid defaults. Terminal
aesthetics. Finance-terminal density. Rainbow data colouring. Decorative metrics. Excessive icons.
Arbitrary hover animation. Red/green good-bad health signalling. Tiny dashboard charts. Every
metric at equal visual priority. Sterile pure-white emptiness. Documentation styling for Method.
Research-paper styling for the consumer application. Visual complexity that only performs
technicality. Obvious AI-generated patterns.

Do not avoid common design elements purely because they are common. The goal is not novelty. The
goal is deliberate design.

---

# 15. Design-system scope

## Foundations

Typography system and scale. Colour palette, neutral palette, primary accent family, data colours.
Spacing scale. Layout and grid principles, maximum widths. Surfaces, dividers, borders. Radius
philosophy. Shadow philosophy if justified. Interaction states. Motion principles.

## Data visualisation

Visual treatment for every element listed in section 9, including the low-confidence and early
states.

## UI primitives

Navigation. Metric readouts. Analytical conclusions. Text actions. Primary and secondary actions.
Disclosures. Drill-down entry points. Tabs and tier switching. Inputs. Goal controls. Detail
navigation. Dividers. Data tables where necessary.

Do not build a large enterprise component library. Establish only the primitives HealthTrend needs.

## Scientific / Method content

Long-form text width. Headings. Explanatory sections. Callouts only where genuinely useful. Diagram
and figure treatment. Equation presentation. Mathematical appendix styling. Inline code and code
provenance. Assumptions and limitations. Progression from intuitive explanation to technical
detail.

Use the Distill references as the major inspiration here.

---

# 16. Synthesis

Each reference contributes something specific: Apple for hierarchy, composition, typography,
scale, motion and progressive reveal; Oura for calm health interpretation and approachable
hierarchy; TradingView for chart precision and instrument-quality interaction; Bloomberg for
analytical credibility; MacroFactor for the importance of rate and the trend-versus-noise
distinction; Distill for scientific explanation and equation typography; Apple Health as a warning
that clean without editorial hierarchy still reads as basic.

**Synthesize these. Do not average them.**

Do not produce Apple colours plus Oura cards plus a TradingView graph plus Bloomberg typography.
Produce a coherent visual language that feels specifically like HealthTrend.

> A premium consumer analytical instrument: calm at the surface, precise when inspected, and
> mathematically rigorous when explored.

The experience should communicate:

> Here is what your trajectory is actually doing. Here is how confident we are. Here is where it
> is heading. And, if you want to know, here is exactly why.

---

# Appendix A — Generation prompt

Paste this alongside the reference screenshots and this document.

```text
Create the HealthTrend visual design system.

Use the attached brief and reference screenshots. The references are inspiration and
evidence of taste, not templates — do not reproduce any of them literally.

Establish:
- visual principles
- typography, including typeface direction, numeral style and precision rules
- colour and data colour roles
- spacing and layout
- composition and hierarchy
- surfaces and containers
- motion philosophy
- data visualisation language, including low-confidence and early states
- the essential UI primitives HealthTrend needs
- scientific and mathematical presentation for Method

Explain the reasoning behind consequential visual decisions.

Where there is a genuinely important unresolved aesthetic choice — typeface direction in
particular — show a small number of clearly differentiated alternatives rather than picking
silently.

DO NOT:
- design the final HealthTrend Analysis page
- redesign the product architecture
- invent functionality or new statistical capabilities
- turn the product into a fitness dashboard
- add calorie, workout or chatbot features
- import the visual styling of the current implementation
- produce a dark mode
- build a large generic component library

After this system is approved, the next step is to test it on a specimen page before
applying it to the product.
```

---

# Appendix B — Known gaps

- **No positive mobile reference.** Section 5 compensates with written direction, but this remains
  the weakest-evidenced part of the brief. Worth adding one or two strong mobile app references
  before the mobile design stage.
- **No brand assets.** No logo or wordmark is included. If one exists, add it. If not, the system
  will need a typographic wordmark decision at some point.

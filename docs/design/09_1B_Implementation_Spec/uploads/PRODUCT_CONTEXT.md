# HealthTrend — product context

Durable product and design context for the HealthTrend visual design work.

---

# 1. What HealthTrend is

A consumer health analytics product focused initially on body-weight trajectory.

Daily scale measurements are noisy. A user cares much more about what their underlying
trajectory is actually doing, how quickly it is changing, how certain we are, where it appears
to be heading, and what evidence supports that interpretation — than about one isolated reading.

> Understand what your weight is actually doing beneath the noise, how confidently we know it,
> and where the current trajectory is heading.

HealthTrend is not a weight logger. It should feel like trajectory intelligence.

---

# 2. Product philosophy

The user moves through increasing depth:

**Conclusion → Explanation → Evidence → Statistics → Method / Mathematics**

The surface stays understandable to a normal consumer. The deeper layers reward technically
sophisticated users with real statistical transparency.

HealthTrend never pretends complexity doesn't exist. It progressively reveals it.

---

# 3. What actually exists today

The statistical backend exists. The model is a continuous-time local-linear-trend state-space
model / Kalman filter supporting irregularly timed measurements.

Real outputs available:

- latest / raw measured weight
- estimated underlying / trend weight
- current velocity / rate of change
- numerical uncertainty
- probabilistic forecasts at 7, 30 and 90 days
- goal-related presentation arithmetic where a goal exists

**Statistical honesty — this matters:**

- It behaves correctly under its assumed linear-Gaussian model.
- Irregular observation spacing is supported.
- **Fixed documented model parameters are used.** Short-history per-user maximum-likelihood
  fitting is NOT justified by the evaluation.
- Simpler classical methods can outperform the shipped Kalman model in some synthetic regimes.
- The model is not presented as a universal winner.
- HealthTrend is the inference and evaluation system, not a brand built around one algorithm.

**Do not turn statistical assumptions into visual certainty.**

---

# 4. What does NOT exist yet

Future capabilities. **Must not be visually faked.**

No plateau detector. No reversal detector. No trend-change or change-point engine. No checkpoint
engine. No qualitative confidence classifier. No strong/weak evidence classification. No
muscle-loss detector. No calorie diary. No workout tracker. No AI health chatbot. No persistent
user accounts. No persistent goal storage. No Apple Health integration. No smart-scale
integration. No body-fat vision system.

If a capability is not implemented, it should simply be absent.

Do not show messages like "not enough evidence for a plateau" when no plateau detector exists.

**Do not invent intelligence in the interface.**

---

# 5. Existing V2 prototype

An isolated V2 prototype exists, with a main Analysis experience, scenario prototypes (gradual
loss, noisy, irregular) and a separate Method destination.

It is functionally useful but its **current visual styling is not the design authority.**

Treat the existing implementation as **architecture and behaviour reference**, never as
aesthetic reference.

---

# 6. Desktop architecture

**Large trajectory chart + analysis rail**, with the chart as the dominant region and the visual
hero.

The rail answers: *what does this analysis say about my data?*

The main state gives a repeat user the important answer quickly — estimated underlying weight,
current rate, trajectory chart, concise interpretation. The user must not need to scroll through
a cinematic sequence before retrieving those.

---

# 7. Deeper analysis architecture

**Main Analysis → Inspect analysis → Why / Evidence / Statistics**

Only one deep tier appears at a time.

- **Why** — explains why HealthTrend reached the interpretation.
- **Evidence** — the observations supporting it.
- **Statistics** — numerical inference and forecasts.

The scroll layer may contain a beautiful "Inspect analysis" entry point, but that section is only
a **route into** the deeper analysis. It must not duplicate the full Why / Evidence / Statistics
content. There is one home for it.

---

# 8. Method architecture

A separate destination with a different job.

- **Analysis:** what does HealthTrend say about my data?
- **Method:** how does HealthTrend calculate and justify this?

Sections: what HealthTrend estimates; how a reading changes the estimate; what uncertainty means;
how forecasting works; model parameters; assumptions and limitations; Mathematical Appendix.

The Appendix holds the real equations and implementation provenance. Full mathematics does not
belong in the analysis rail.

---

# 9. Mobile architecture

Desktop must not collapse into a stack of cards.

**Conclusion → key metrics → large trajectory chart → interpretation → deeper analysis**

The chart remains important and scrolls normally rather than staying sticky over half the
viewport. Design deliberately for approximately 320, 375, 390 and 430px.

---

# 10. Goals

A goal may exist in the prototype but is ephemeral. There is no account or persistence system.

Do not design URL persistence, localStorage or backend account storage as though it exists.

The product evaluates trajectory relative to the user's goal. It does not prescribe medically
correct targets.

---

# 11. Core visual ambition

Not another generic health dashboard. Not an AI-generated SaaS interface.

> A premium consumer analytical instrument: calm at the surface, precise when inspected, and
> mathematically rigorous when explored.

Premium, elegant, calm, precise, mathematically credible, trustworthy, non-judgemental,
consumer-first, distinctive.

**The core challenge is that clean ≠ basic.** A basic design removes things. An elegant design
removes things while making the remaining hierarchy, proportion, typography, spacing, data
visualisation, composition and motion more intentional.

---

# 12. Reference synthesis

**Apple** — visual authorship, typography, scale, spacing, composition, progressive reveal,
continuity, motion, giving statistics room to breathe. Not literally an iPhone marketing page;
routine use must stay fast.

**Oura** — calm consumer-health interpretation, approachable handling of complex information,
readable hierarchy. Not excessive whiteness, too many simultaneous concepts, or rounded-card
health-app appearance.

**TradingView** — graph precision, crosshair behaviour, axes, plotting discipline,
instrument-quality interaction, restrained data colours. Not terminal density, dozens of
controls, or intimidating complexity. Target: TradingView-level precision with Apple/Oura-level
restraint.

**Bloomberg** — analytical seriousness and credibility, conceptually only. Too dense and
utilitarian to be a visual target.

**MacroFactor** — functional conventions only: rate matters, trend versus noisy reading. Too busy
and generic visually.

**Apple Health** — a negative control. Even an Apple interface feels basic when it presents
health numbers without editorial judgment. HealthTrend has an argument: *here is what your
trajectory is doing beneath the noise, and here is why we believe it.*

**Distill** — Method and the Mathematical Appendix. Beautiful mathematical presentation,
prose-equation relationships, generous technical spacing, progressive depth, scientific
credibility without documentation styling. The consumer application must not look like a
research paper.

---

# 13. Progressive reveal

Borrow from Apple's product pages: spacious section transitions, strong numerical moments,
smooth scroll-triggered reveals, continuity between ideas, one primary idea at a time.

A possible progression — initial surface carries chart, estimated weight, current rate and a
concise interpretation; deeper exploration then covers reading today, current trajectory, where
you're heading, goal, and inspect analysis.

But: no scroll-jacking, no mandatory cinematic sequence, no delayed access to the important
answer, no animation the user must replay every visit.

The primary chart and analysis experience remains immediately useful.

---

# 14. The chart

HealthTrend's signature visual object. Not a generic dashboard card — a serious analytical
instrument.

Must account for raw measurements, inferred trajectory, uncertainty band, forecast, forecast
uncertainty, goal reference, current-value indicator, historical/forecast boundary, axes, grid,
crosshair, inspection readout, and range controls.

Visual priority: **estimated trajectory > supporting statistical context > raw measurements.**
Raw data matters but must not overpower the interpretation.

---

# 15. Rate

One of the highest-value outputs. Do not bury it among secondary statistics.

But estimated weight, rate, interpretation and chart must not all compete equally. Use editorial
hierarchy.

---

# 16. Colour

**Light mode only.** No dark mode effort.

Light mode should feel refined, dimensional and calm — not sterile, empty or pure white
everywhere. A subtle tonal surface system is welcome.

One primary saturated accent family, preferably cool blue / blue-azure. No purple AI styling,
neon, rainbow palettes, decorative gradients or glow.

The inferred trajectory line carries the strongest saturated analytical colour. Raw measurements
are quieter. Uncertainty and forecast are visually related to the trajectory but subordinate.

**Colour represents data roles, not health morality.** Never green = good, red = bad. A
maintenance trajectory can be success depending on the user's goal.

---

# 17. Containers

Do not cardify HealthTrend.

Prefer spacing, alignment, typography, proximity, subtle dividers and tonal changes before boxes,
borders, shadows and rounded rectangles.

Cards are not forbidden. They must earn their existence.

---

# 18. Typography

Typography carries a large part of the identity. Roles needed for hero metrics, rate, analytical
conclusion, secondary values, metadata, chart labels, navigation, long-form Method prose and
mathematical equations.

Hero numbers need real scale contrast — not merely one heading size larger than everything else.

Tabular lining figures where values update.

---

# 19. Motion

For continuity, hierarchy, state change, progressive reveal, movement into deeper analysis,
metric transitions, goal interaction and subtle interaction feedback.

Not to show off. No scroll-jacking, gratuitous hover animation, delayed information or forced
sequences. Support reduced motion.

---

# 20. Avoid

Generic SaaS dashboards. Rounded-card grids. Bento layouts. Purple/black AI styling. Glow.
Decorative gradients. Generic fitness-app styling. Trading-terminal cosplay. Fake terminal
components. Rainbow colouring. Excessive icons. Decorative metrics. Tiny charts. Equal priority
for every statistic. Red/green health judgement. Sterile pure-white emptiness. Generic
documentation styling for Method. Research-paper styling for the whole application. Visual
complexity merely to appear technical. Obvious AI conventions.

Do not reject common UI elements purely because they are common. The goal is deliberate visual
authorship, not novelty.

---

# 21. Scope boundary

Do not expand product scope. Do not invent features because they would make a mockup look better.

Preserve: statistical honesty, chart semantics, the existing analysis architecture, the
Why / Evidence / Statistics structure, the separate Method destination, the mobile information
hierarchy, and ephemeral goal behaviour.

**If a design idea implies a consequential product-architecture change, say so explicitly before
doing it.**

The success criterion is not "cleaner than the old prototype." It is: *this feels like a
deliberate, premium HealthTrend product that could not be mistaken for a generic AI-generated
dashboard.*

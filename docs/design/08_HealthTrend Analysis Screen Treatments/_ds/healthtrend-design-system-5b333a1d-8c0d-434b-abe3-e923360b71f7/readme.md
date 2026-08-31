# HealthTrend — Design System

HealthTrend is a premium consumer health-analytics product. It estimates a person's **underlying
weight trajectory** from noisy day-to-day scale measurements, and shows five things: where the trend
sits now, how fast it is moving, how confident the estimate is, where it is heading, and the
statistical evidence behind all of that.

Two surfaces:

1. **Web application** — the trajectory screen (hero), the measurement ledger, an evidence screen
   with model parameters and diagnostics, and settings.
2. **Method section** — a separate long-form document explaining the mathematics: a state-space
   local-linear-trend model with fixed, documented parameters, plus figures, notation and citations.

The product's governing conviction: **the interface argues rather than sells.** It shows the
estimate, admits its uncertainty in the same breath, and never states a claim the model does not
produce.

## Sources given to me

- `uploads/03_Oura.png` — Oura *Trends* web view. Reference for data density, the navy/azure data
  palette, the whole-history range strip with the active window highlighted, terminal value flags
  pinned to the right of a series, and tabular figures in chart furniture.
- `uploads/07_apple.png`, `uploads/08_apple.png` — Apple product pages. Reference for restraint:
  huge type on white, structural whitespace, one accent colour, near-invisible chrome, sentence-case
  copy, and a pill segmented control.
- `uploads/10_distill.png`, `uploads/11_distill.png` — Distill.pub articles. Reference for the
  long-form Method surface: serif prose at a narrow measure, a title block of small labelled
  columns, recessed grey figure wells, interactive figures with sliders and radio sets, mono
  notation, sidenotes and numbered citations.

No codebase, Figma file, logo, font binaries or slide template were provided. Nothing here is
reverse-engineered from those references' brands — they were read as *behavioural* references
(density, restraint, scholarly rhythm), and every value in this system is authored for HealthTrend.

### Brand mark

**There is no logo.** None was supplied, and none has been drawn. Wherever a mark would go, the
word `HealthTrend` is set in the display serif (see `guidelines/brand-wordmark.html`). If a real
mark exists, drop it at `assets/logo.svg` and replace the wordmark in `ui_kits/app/AppShell.jsx`
and `ui_kits/method/MethodHeader.jsx`.

### Font substitution — needs your input

No font binaries were provided, so `tokens/fonts.css` loads the nearest Google Fonts matches to the
brief:

| Role | Chosen | Why |
| --- | --- | --- |
| Prose (serif) | **Source Serif 4** | Argumentative, optical-size axis, not a bookish revival; carries all language. |
| Numbers (sans) | **IBM Plex Sans** | True tabular + lining figures, humanist rather than a neutral grotesque. |
| Notation (mono) | **IBM Plex Mono** | Metrically related to the sans; axes and formulae. |

**If you have licensed families, send them** and I will swap the `@import` for local `@font-face`
rules — the token names will not change.

---

## CONTENT FUNDAMENTALS

**Voice.** A careful analyst explaining their work to an intelligent adult. Confident about method,
scrupulous about uncertainty. Never a coach, never congratulatory, never worried on your behalf.

**Person.** Second person for the reader's data ("your goal", "17 days have no reading"), first
person plural only for methodological choices ("we estimate them from your own history"). The model
is a third party with agency — "the filter", "the model", "the estimate" — which lets the UI
attribute claims: *the model puts your trajectory at 76.2 kg*, not *you weigh 88.6 kg*.

**Casing.** Sentence case everywhere: headings, buttons, labels, table headers. The single exception
is the eyebrow tier (11px, +0.09em) used for metric and section labels — `ESTIMATED TREND WEIGHT`,
`SECTION 3`.

**Numbers in copy.** Always with unit and, where the model produced one, always with an interval in
the same line or the line beneath: `−0.27 kg/week · 95% CI −0.34 to −0.19`. Minus sign is U+2212,
never a hyphen. Ranges use an en dash. See **PRECISION AND ROUNDING** below for how many digits;
`lib/format.js` is the only place those rules live.

**The provenance rule.** Every sentence in the product must trace to a quantity the model outputs.
Allowed: *"99.7% of the posterior mass for velocity sits below zero."* Not allowed: *"You're on
track!"*, *"Great progress this week"*, *"You'll hit your goal by November"* (the model forecasts
under an assumption; say the assumption).

**Uncertainty is not a disclaimer.** It sits beside the number, in the qualifier tier, not in a
footnote or a modal. When data is missing the copy says what that does to the estimate: *"Gaps widen
the band; they do not move the line."*

**Length.** UI copy is one clause. Explanatory blocks are two or three sentences at 34em. Method
prose runs long, but every paragraph advances the argument; nothing recaps.

**Examples, verbatim from this system:**

- Hero: `Estimated trend weight` / `76.2 kg` / `±0.70 kg (68%) / as of today, 06:40`
- Staleness: `No reading for 6 days — interval widening`
- Empty-ish state: `Below three readings a week, the estimate is mostly prior.`
- Button: `Log a weigh-in` (names the object, not "Submit")
- Refusal list, shown in the product: `Why the trajectory changed` · `Body composition` ·
  `Whether the rate is healthy`
- Method lede: *"A bathroom scale is an honest instrument answering a question you did not ask."*

**No emoji, anywhere.** No exclamation marks. No "just", "simply", "easy". No streaks, badges,
celebrations, or nudges.

---

## VISUAL FOUNDATIONS

**Light mode only.** There is no dark theme and no theme toggle.

**Colour.** One saturated accent — azure `--azure-500` `#1668c9` — plus five cool-cast inks, three
papers, three rule greys, and amber reserved for *data* staleness. No purple, no gradients, no
glows, no tinted shadows. **Colour encodes data role, never health judgement**: the same azure line
draws a gain and a loss; there is no green "good" and no red "bad" in the system
(`guidelines/brand-nonjudgement.html`). Roles: `--data-trend` (estimate), `--data-band-68/95`
(uncertainty), `--data-raw` (measurements, neutral grey), `--data-projection` (dashed, same hue),
`--data-reference` (neutral dashed, for things the user supplied), `--data-stale` (amber).

**Typography.** Three families, three jobs. Serif carries all language; sans carries every number
with tabular figures forced on (`--feat-tabular`); mono appears only on axes, tick labels and
notation. Hero metrics use *dramatic* scale contrast, not one step up: **112 px → 30 px → 15 px**
across the three metric tiers.

**Metric hierarchy (explicit, enforced by the components).**
- **Tier 1 — estimated trajectory.** `HeroMetric`, 112px/0.86, tracking −0.035em, weight 400. One
  per screen. Always carries an interval.
- **Rate is hero-adjacent, not tier 2 by placement.** The current rate is a headline metric: it
  renders at tier-2 *size* but must sit in the hero region — pass it to `HeroMetric` as `rate`.
  It never appears inside the tier-2 statistics group next to `n`, `σ` and `R²`, where it reads as
  one diagnostic among many. There is no size tier between 112 and 30; adjacency carries the rank.
- **Tier 2 — supporting statistical context.** `SupportingMetric`, `TrendDelta`, 30px. Projection,
  change over range, model σ, n, R².
- **Tier 3 — raw measurements.** `RawReading`, `MeasurementTable`, 15px — *never larger than body
  text*, never azure, never at hero scale.
- **Readout tier** — 19px (`--size-metric-readout`, `.ht-metric-readout`) for values that update
  under the cursor: the crosshair value and the chart's terminal flag. More presence than a label,
  less than a page metric.
- **Qualifier tier** — 12.5px tabular sans for intervals, sample counts, units, windows, staleness.
  Distinct from body copy and from tier 3 (`guidelines/type-qualifier.html`).

**Hero numerals — settled by the typeface.** `.ht-metric-hero` forces tabular figures, and it turns
out there is nothing to choose: IBM Plex Sans ships a single figure width, so `tnum`, `pnum` and
`normal` all measure identically (299.27px for "111.8" at 112px). Tabular is therefore both the
intended behaviour and the only behaviour — the decimal point always holds its column and the hero
number never shifts as it updates. Re-open only if a licensed cut with a proportional figure set
arrives. Specimen: `guidelines/type-hero-figures.html`.

**Measure and column rules.** Prose is pinned to `--measure-prose` 34em (~66 characters) and set
with `text-wrap: pretty`; ledes and section openers may reach 44em; captions, sidenotes and
qualifiers are 24em. Columns: body 680px, page 1000px (figures and charts), screen 1400px, with a
220px margin-note gutter that collapses below 1180px. Prose never fills a column edge-to-edge and
never leaves a one-word last line: use `Prose`, which owns both the measure and the 24px paragraph
rhythm.

**Figure escape.** Prose stays at `--col-body`; only figures escape, and only to a *named* column —
`.ht-escape-page` (680 → 1000) for charts and wide diagrams, `.ht-escape-screen` (680 → 1400) for the
hero trajectory chart and full evidence tables. The escape is symmetric negative margin, never a
transform (a transform fights the reveal transition) and never `position: absolute`. Captions do not
escape: they stay at 24em, aligned to the escaped figure's left edge. Never nest one escape inside
another. Specimen: `guidelines/layout-figure-escape.html`.

**Whitespace is structural — very few visible containers.** Groups are made by alignment and space:
`--gap-stack` 16 within a group, `--gap-group` 32 between metric groups, `--gap-block` 64 between
prose and figures, `--gap-section` 128 between page sections. Sections are separated by space, or at
most a 1px `--rule-2` hairline. **There are no cards.** The only filled surface is the recessed
figure well (`--surface-well` `#f7f8fa`, square corners, no border, no shadow) borrowed from
Distill; the only floating surface is the weigh-in panel and tooltips.

**Backgrounds.** Flat white. No imagery, no photography, no illustration, no texture, no pattern, no
full-bleed hero images, no gradients. If imagery ever enters the brand it should be cool, neutral
and unsaturated — but none is used today, and none has been generated here.

**Borders and radii.** Hairlines carry structure: `--rule-1` for table rows, `--rule-2` for section
dividers, `--rule-3` for axis lines, dashed `--rule-2` for projections and references, 2px azure for
the active tab. Radii are near-zero: **0** for charts, tables, wells and figures; **3px** for
buttons, inputs and badges; **6px** for tooltips and the overlay panel; pill only for the segmented
control track.

**Shadows.** One token, `--shadow-overlay`, and its tooltip variant. Nothing that sits in the page
casts a shadow — only things that float above it. No inner shadows, no glow, no coloured shadow.

**Transparency and blur.** Transparency appears only in data: the two uncertainty bands
(`rgba(22,104,201,.17 / .085)`), the raw-dot fill, and the range-strip selection. No frosted glass,
no backdrop blur, no protection gradients — the overlay panel uses a flat 18% ink scrim.

**Charts.** The trajectory chart is the hero object, not a widget: full page width, ≥420px tall,
horizontal gridlines only, mono tick labels, a right-hand terminal flag showing the current
estimate, and a crosshair readout on hover. Layer order is fixed: 95% band → 68% band → raw dots →
dashed projection → azure trajectory. Strokes: trend 2.25px, projection 1.75px, raw dots r=1.7,
grid 1px.

**Motion.** 90ms hover/press, 140ms control state, 220ms panel reveal, 320ms chart re-scale on range
change; easing `cubic-bezier(.2,0,.2,1)`. No bounce, no spring, no parallax, and **data never
animates in** — a chart that draws itself is a chart you cannot read yet. All durations collapse to
0 under `prefers-reduced-motion`.

**Scroll-linked progressive reveal (primitives, not a sequence).** The reveal layer sits *below* the
analytical surface; the returning user sees the estimate, the rate and the chart without scrolling.
The primitives a sequence is composed from live in `tokens/motion.css` and the `Reveal` component:

| Token | Value | Job |
| --- | --- | --- |
| `--dur-reveal` / `--dur-reveal-lg` | 480ms / 620ms | element step / section step |
| `--ease-reveal` | `cubic-bezier(.17,.62,.24,1)` | decelerating, no overshoot |
| `--reveal-offset-y` / `-lg` | 14px / 24px | translate distance |
| `--stagger-1` / `--stagger-2` | 40ms / 70ms | siblings / sections |
| `--stagger-cap` | 6 | later items share the 6th delay, so a 30-row block never waits |
| `--reveal-threshold` | 0.28 | fraction in view before firing |
| `--transition-reveal` | opacity + transform | the composite |

Three rules bound every reveal, and breaking one is a bug rather than a style choice: it **never
gates information** (content is in the DOM, the accessibility tree and print before it reveals, and
self-reveals without `IntersectionObserver`); it **fires once** (scrolling back does not replay it);
it **never drives scroll** (no pinning, no scrubbing, no scroll-jacking). Under
`prefers-reduced-motion` durations go to 0 *and* `.ht-reveal` is pinned to its terminal state —
zeroing duration alone can leave an element mid-transform. Never wrap the hero metric, the rate or
the trajectory chart. Specimen: `guidelines/motion-reveal.html`.

**Hover states.** Text and icons darken one ink step; rows and quiet buttons take `--paper-3`;
primary buttons darken to `--azure-600`; links move from `--azure-300` to `--azure-500` on the
underline. **Press states** darken again (`--azure-700`) — nothing scales, nothing lifts.

**Focus.** 2px `--azure-500` outline at 2px offset, 3px radius. Never removed.

---

## LOW-CONFIDENCE AND EARLY STATES

The product's argument depends on stating confidence honestly, so these are **first-class states with
their own components and tokens**, not caveats bolted onto the confident layout. One function
decides which state applies — `HTFormat.confidence({ n, perWeek, halfWidth68, daysSinceReading })` —
and every component reads it rather than inventing thresholds: fewer than 10 readings or under 3 a
week → `insufficient`; no reading for 5+ days → `stale`; 68% half-width at or above 0.5 kg (1.1 lb)
→ `wide`.

**Insufficient data.** No trajectory is drawn at all. `InsufficientData` takes the hero region and
states what the model needs, at tier 2 — there is no number to be huge, and a weak line shown
confidently would be the single worst thing this product could do. `TrajectoryChart
confidence="insufficient"` plots the raw readings and omits the trend, both bands, the projection and
the crosshair. The reading-count ticks are a count, not a progress meter: no percentage, no fill, no
completion language. Copy: *"Not enough readings to estimate a trajectory"* /
*"Below three readings a week, the estimate is mostly prior."*

**Wide uncertainty.** The band gains presence and the line loses it — `--data-band-68/95-wide`
(.24/.13) against `--data-trend-provisional` at 1.75px and 62% alpha. The band, not the line, becomes
the honest headline. The hue never changes: a weak estimate is not a different *kind* of number.
The hero numeral steps back one ink (ink-2) and **precision drops a decimal**, because an estimate
with a ±0.6 kg interval has no business printing a tenth.

**Stale data.** The estimate ages; it does not move. `staleAfterIndex` hatches the region past the
last reading (`--data-stale-hatch`) and rules the boundary in `--data-stale-rule`; the hero carries
an amber qualifier clause, the header a `Badge tone="stale"`. Copy: *"No reading for 6 days —
interval widening"* / *"Gaps widen the band; they do not move the line."* Amber describes the age of
**data**, never the body.

**Outlier readings.** A hollow ink ring at reading radius ×2 — kept, visible, not dramatised. Never
red, never deleted from the series, never greyed out of the ledger. `OutlierFlag` draws the same ring
in the table so the chart and the ledger agree, and the residual is stated in σ so the reader can
judge it. Several consecutive flags are a data problem to describe in prose, not more rings.

Specimens: `guidelines/state-insufficient.html`, `state-wide.html`, `state-stale.html`,
`state-outlier.html`.

---

## PRECISION AND ROUNDING

Precision is a claim. False precision undermines the honesty the product is selling, and too little
hides the rate signal. **All rules live in `lib/format.js` (`window.HTFormat`)** — one module, called
at the boundary, so a chart, a table and a hero cannot drift apart. Components stay presentational
and take pre-formatted strings.

| Quantity | Confident | Low confidence | Rule |
| --- | --- | --- | --- |
| Trend weight | `76.2` | `76` | 1 decimal; 0 once the 68% half-width reaches 0.5 kg / 1.1 lb |
| Rate | `−0.27 kg/week` | `−0.3 kg/week` | 2 decimals per week — 0.05 kg/week is 2.6 kg a year |
| Interval half-width | `±0.70 kg (68%)` | `±0.8 kg (68%)` | 2 decimals; 1 when wide — finer than the estimate, because it is a smaller quantity |
| Raw reading | `82.1` | `82.1` | always 1 decimal — a measurement, not a claim |
| Crosshair readout | `76.24` | `76.24` | 2 decimals: the one place fuller precision earns its place |
| Axis tick | `78.0` | `78.0` | 1 decimal, mono, tabular |
| Model quantities | `σ = 0.71 kg` | | `n = 103`, `R² = 0.91`, `p < 0.001` — notation stays notation |

An interval's **half-width is printed finer than the estimate it qualifies** — `±0.70` against
`76.2` — because it is a different order of magnitude, and `±0.8` against `76` still resolves what
`±1` would destroy. Interval *bounds*, by contrast, are magnitudes like the estimate, so
`HTFormat.interval()` and `range()` use the estimate's own precision.

Rate is always signed (the sign *is* the information) and always per a named window — `per:
'fortnight'` doubles the value and the label. Minus is U+2212, ranges use an en dash. When the rate's
interval spans zero, `TrendDelta` must use `direction="flat"`.
Specimen: `guidelines/precision-rules.html`.

---

## UNITS, LOCALE AND DATES

The model works in kilograms; display converts (`--kg-per-lb` 0.45359237, in `HTFormat`). **Unit
treatment is part of the hero composition, not a suffix.** The unit sits on the hero baseline at
tier-2 size in ink-3 — never superscript, never small-caps, never at hero size.

**The lb layout consequence is solved by reserving slots, not by reflowing.** `76.2 kg` and
`168.0 lb` differ by a character, and at 112px with −0.035em tracking that shift is visible across the
whole page. Pass `digits={HTFormat.digitSlots(unit)}` (5) to `HeroMetric` on any surface where the
unit can change: the numeral gets `min-width: 5ch`, right-aligned, so the decimal point holds its
column and switching units moves nothing else. Tabular figures make `ch` exact.

**Per-unit precision** lives in `HTFormat.UNITS`: both units carry 1 decimal for weight, 2 for rate
and 2 for an interval half-width. The **wide-uncertainty threshold is not per-unit** — uncertainty is
physical, so it is held once, in kilograms (`THRESHOLDS.wideHalfWidth68Kg` = 0.5 kg), and
`HTFormat.wideThreshold('lb')` expresses that same value as 1.10 lb for copy. An identical estimate
classifies identically whichever unit the reader has selected; a display choice can never suppress
the wide state.

**Dates and times.** 24-hour clock and `D MMM` by default; `HTFormat.setLocale({ clock: '12h',
dateOrder: 'MDY', decimal: ',' })` switches all three, including the decimal mark. Time appears only
where it means something — a weigh-in has a time of day, a projection does not. `asOf` is relative
inside a week (*"as of today, 06:40"*, *"as of 4 days ago, 07:10"*) and absolute beyond it, because
*"as of 23 days ago"* is arithmetic homework. Axis ticks are month abbreviations, mono, tabular.
Specimen: `guidelines/units-hero.html`.

---

## ICONOGRAPHY

- **No icon set was supplied.** The system standardises on **Lucide**, loaded from CDN
  (`unpkg.com/lucide@0.475.0`) by the `Icon` component — **flagged as a substitution**: swap the URL
  for local SVGs if HealthTrend owns a set. Nothing here is a hand-drawn approximation of a real
  brand's glyphs.
- **Stroke weight is fixed at 1.5px** (`--stroke-icon`) at 13–18px box sizes. Monochrome, inheriting
  `currentColor`. Never filled, never two-tone, never coloured to signal outcome.
- Icons are **sparse and functional**: navigation (`trending-down`, `table-2`, `sigma`, `book-open`,
  `sliders-horizontal`), toolbar actions (`download`, `refresh-cw`, `settings-2`, `x`), qualifier
  glyphs (`info`, `clock`, `circle-slash`, `minus`), and direction on `TrendDelta`
  (`arrow-down-right`, `arrow-up-right`, `move-horizontal`). No decorative icons, no icons in
  headings, no icon-led empty states.
- **Direction, never verdict.** `TrendDelta` shows an arrow and stays ink-coloured; when the interval
  crosses zero it must use `direction="flat"`.
- **No emoji, ever.** Unicode is used for *mathematics and typography* only — `−` (U+2212), `±`,
  `σ`, `η`, `ζ`, `ε`, `Δ`, subscripts, `·`, `—`, `≈`, `R²`, `√`. Data marks are drawn by the chart
  components, not by glyphs.
- `assets/` holds no imagery because the sources contained none. Do not generate any.

---

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | Root entry — `@import` list only. Consumers link this one file. |
| `lib/format.js` | `window.HTFormat` — precision, rounding, units, locale, dates, confidence thresholds. Load before the bundle. |
| `tokens/fonts.css` | Family tokens + Google Fonts substitution (see flag above). |
| `tokens/colors.css` | Ink, paper, rules, azure, amber + semantic aliases. |
| `tokens/typography.css` | Sizes, weights, tracking, the three metric tiers, `.ht-*` tier classes. |
| `tokens/spacing.css` | 13-step scale + semantic rhythm (`--gap-stack` … `--gap-chapter`). |
| `tokens/layout.css` | Measures, columns, chart geometry, radii, shadows. |
| `tokens/lines.css` | Hairline and stroke tokens. |
| `tokens/motion.css` | Durations, easings, transitions, scroll-reveal primitives. |
| `tokens/dataviz.css` | Data-role colours, including the wide/stale/outlier state roles. |
| `tokens/base.css` | Minimal element defaults, link colours, focus ring. |
| `guidelines/*.html` | 29 specimen cards (Colors, Type, Spacing, States, Motion, Brand). |
| `thumbnail.html` | Project tile. |
| `SKILL.md` | Agent-skill entry point for use outside this project. |

### Components

Authored from the brief (no source inventory existed), grouped by concern. Every component has a
sibling `.d.ts` and `.prompt.md`.

**`components/core/`** — `Icon`, `Button`, `IconButton`, `SegmentedControl`, `Select`, `Input`,
`Switch`, `Badge`, `TextLink`, `Tooltip`
**`components/metrics/`** — `HeroMetric`, `SupportingMetric`, `RawReading`, `Qualifier`, `TrendDelta`
**`components/data/`** — `TrajectoryChart`, `Sparkline`, `ChartLegend`, `MeasurementTable`,
`RangeStrip`
**`components/prose/`** — `Prose`, `SectionHeading`, `FigureCaption`, `MarginNote`, `Equation`,
`Citation`
**`components/states/`** — `InsufficientData`, `ConfidenceNote`, `OutlierFlag`
**`components/motion/`** — `Reveal`

**Intentional additions.** `Icon` — a wrapper over the substituted Lucide set, so glyphs are never
pasted as raw SVG. `Input` — the weigh-in and goal fields need a numeric field, and no source
defined one. `InsufficientData`, `ConfidenceNote`, `OutlierFlag` — the brief names low-confidence and
early states as first-class design cases (§9), and a state with no component is a state every
consumer will improvise differently. `Reveal` — the brief's progressive-reveal layer (§4.2, §10) needs
a primitive, or every surface hand-rolls a timeline and the once-only and reduced-motion guarantees
get lost.

**Deliberately absent:** Toast, Avatar, Modal, Accordion, Breadcrumb, progress meters, gauges,
donut/ring charts, streak widgets. Nothing in the brief needs them, and a gauge would imply a
judgement scale this product refuses to draw.

### Templates

The consuming-project starting points. Each is a Design Component that loads this system through a
sibling `ds-base.js`; edit the `base` line in that file when copying into another project.

| Template | Entry | What it seeds |
| --- | --- | --- |
| Trend view | `templates/trend-view/TrendView.dc.html` | App shell + hero trajectory screen. Tweaks: unit, chart layers, chart height, and the fixture series (days, start weight, weekly rate, goal). |
| Method article | `templates/method-article/MethodArticle.dc.html` | Long-form Method page: title block, two sections, notation, margin notes, figure well, references. Tweaks: revision, reading time, figure height, bands, fixture series. |

### UI kits

| Kit | Entry | Screens |
| --- | --- | --- |
| `ui_kits/app/` | `index.html` | Trend (hero), Measurements, Evidence, Settings, weigh-in panel |
| `ui_kits/method/` | `index.html` | Long-form Method article with interactive figures |

Both read the same deterministic fixture series (`ui_kits/app/fixtures.js`).

**All numbers in the kits and templates are FIXTURES.** `ui_kits/app/fixtures.js` and each
template's logic class generate a deterministic, invented series; the model parameters, intervals,
p-values and diagnostics shown are placeholders for layout. They are labelled as fixtures in the
interface itself (a `Fixture series` badge in the app header, fixture notes in figure sources and
qualifiers) and must stay labelled until real model output replaces them. **The product must never
show a statistical claim the model did not produce** — see the provenance rule above.

No slide template was provided, so no sample slides exist.

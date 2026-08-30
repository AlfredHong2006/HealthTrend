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
never a hyphen. One decimal for weights on screen, two in tables and readouts. Ranges use an en
dash. `n = 103`, `σ = 0.71 kg`, `R² = 0.91` — mathematical notation stays in mathematical form.

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
- **Tier 2 — supporting statistical context.** `SupportingMetric`, `TrendDelta`, 30px. Rate,
  projection, change over range, model σ, n.
- **Tier 3 — raw measurements.** `RawReading`, `MeasurementTable`, 15px — *never larger than body
  text*, never azure, never at hero scale.
- **Qualifier tier** — 12.5px tabular sans for intervals, sample counts, units, windows, staleness.
  Distinct from body copy and from tier 3 (`guidelines/type-qualifier.html`).

**Measure and column rules.** Prose is pinned to `--measure-prose` 34em (~66 characters) and set
with `text-wrap: pretty`; ledes and section openers may reach 44em; captions and sidenotes are 24em.
Columns: body 680px, page 1000px (figures and charts), screen 1400px, with a 220px margin-note
gutter that collapses below 1180px. Prose never fills a column edge-to-edge and never leaves a
one-word last line: use `Prose`, which owns both the measure and the 24px paragraph rhythm.

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

**Hover states.** Text and icons darken one ink step; rows and quiet buttons take `--paper-3`;
primary buttons darken to `--azure-600`; links move from `--azure-300` to `--azure-500` on the
underline. **Press states** darken again (`--azure-700`) — nothing scales, nothing lifts.

**Focus.** 2px `--azure-500` outline at 2px offset, 3px radius. Never removed.

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
| `tokens/fonts.css` | Family tokens + Google Fonts substitution (see flag above). |
| `tokens/colors.css` | Ink, paper, rules, azure, amber + semantic aliases. |
| `tokens/typography.css` | Sizes, weights, tracking, the three metric tiers, `.ht-*` tier classes. |
| `tokens/spacing.css` | 13-step scale + semantic rhythm (`--gap-stack` … `--gap-chapter`). |
| `tokens/layout.css` | Measures, columns, chart geometry, radii, shadows. |
| `tokens/lines.css` | Hairline and stroke tokens. |
| `tokens/motion.css` | Durations, easings, transitions. |
| `tokens/dataviz.css` | Data-role colours. |
| `tokens/base.css` | Minimal element defaults, link colours, focus ring. |
| `guidelines/*.html` | 21 specimen cards (Colors, Type, Spacing, Brand). |
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

**Intentional additions.** `Icon` — a wrapper over the substituted Lucide set, so glyphs are never
pasted as raw SVG. `Input` — the weigh-in and goal fields need a numeric field, and no source
defined one.

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

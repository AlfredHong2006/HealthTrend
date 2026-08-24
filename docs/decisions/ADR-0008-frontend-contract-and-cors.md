# ADR-0008 — Frontend contract, data fetching, the chart, and why CORS still is not needed

**Status:** accepted, Milestone 3
**Extends:** [ADR-0006](ADR-0006-http-boundary.md)

## Context

Milestone 3 is the first thing a person can look at: a Next.js page that renders a synthetic demo
scenario as a graph plus three numbers. Four decisions shaped it, and each one is easy to get wrong
in a way that only costs something later.

---

## 1. TypeScript types are generated from the committed OpenAPI contract, not handwritten

### Decision

`backend/openapi.json` is exported from `create_app().openapi()` and committed
(`backend/tests/api/regenerate_openapi.py`, guarded by
`backend/tests/api/test_openapi_contract.py`, which fails the backend suite if the committed file
and the live schema disagree). `openapi-typescript` generates
`frontend/src/lib/api/schema.d.ts` from that committed file — not from a running server — and the
generated file is itself committed, with `frontend/src/lib/api/types.ts` re-exporting narrow,
readable aliases (`DemoAnalysis`, `Forecast`, …) so the rest of the frontend never indexes into the
raw generated shape.

### Why generated rather than handwritten

The response tree is deep — `AnalysisResponse` nests `CurrentEstimateOut`, `ForecastOut`,
`ForecastPointOut` (twice, in both `horizons` and `path`), `ModelParamsOut`, `ObservationOut` and
`TrajectoryPointOut` — and a handwritten interface can drift from any one of those silently. A
backend field rename would compile against a stale handwritten type and fail only at runtime, in
the browser, on a field a test happened not to touch. Generation makes that class of error a build
failure instead.

### Why generated from a committed file rather than a live server

Two reasons. First, reproducibility: the frontend's CI job (`frontend.yml`) needs no Python and no
running backend to typecheck — it regenerates from the checked-out `backend/openapi.json` and diffs
the result. Second, review: a schema change becomes a visible JSON diff in the same pull request as
the backend change that caused it, rather than something the frontend discovers later against a
staging server.

### Why not a full client generator (openapi-fetch, Orval, …)

This frontend calls two endpoints. A generated client is machinery for a problem — many endpoints,
repeated call-site boilerplate — this project does not have. `src/lib/api/client.ts` is nine lines
of plain `fetch` per function; generating that would add a runtime dependency and a second code
path to keep in sync with the hand-written error handling in `src/lib/api/errors.ts`.

### How drift is caught

Two independent guards, one per side of the contract:

1. `backend/tests/api/test_openapi_contract.py` — the committed `openapi.json` must equal
   `create_app().openapi()`, checked in the existing `backend.yml` workflow.
2. `frontend.yml`'s "Check the generated API types are up to date" step — regenerates
   `schema.d.ts` from the committed `openapi.json` and runs `git diff --exit-code` on it.

A schema change with only one of the two regenerations run fails exactly one of the two workflows,
naming exactly which file is stale.

---

## 2. All data fetching happens in a server component; there is no client state

### Decision

`src/app/demo/[scenario]/page.tsx` is an async Server Component. It calls `fetchDemoAnalysis` and
`fetchDemoCatalogue` (both plain `fetch` with `cache: "no-store"`) and passes the results down as
props. Scenario switching is a route (`/demo/{scenario}`), rendered as a list of `<Link>`s in
`ScenarioNav`. There is no `useState`, no `useEffect` performing a fetch, no React Query, no SWR,
and no global state library anywhere in the frontend.

### Why no client-side data fetching

The backend URL then never needs to reach the browser: `HEALTHTREND_API_URL` is read in
`src/lib/config.ts`, which only ever runs server-side, and is deliberately not prefixed
`NEXT_PUBLIC_`. That is a privacy property (`docs/privacy.md`), not just a convenience — it is one
fewer thing an inspecting user's browser can learn about the deployment.

### Why no data-fetching library

React Query and SWR solve caching, revalidation, request deduplication and background refetch. This
page issues exactly one request pair per navigation, the response must never be cached (demo data is
generated relative to the clock — ADR-0007 — so the same URL legitimately differs between requests),
and there is nothing to deduplicate or revalidate in the background. Adding either library would be
solving problems this milestone does not have, at the cost of a provider tree and an API surface
nothing here needs.

### Why scenario switching is navigation, not state

Five `<Link href={"/demo/" + id}>` elements give shareable URLs, browser back/forward, and Next's
route-level `loading.tsx` skeleton, all supplied by the router. The alternative — a client-side
scenario picker holding the fetched analysis in `useState` — would need to reimplement all three,
plus its own loading and error states, in application code.

### The one client component

`TrendChart` is `'use client'`, because its hover tooltip needs `pointermove` events the browser
provides and a server cannot. It receives already-shaped plain arrays as props
(`buildChartSeries`'s output) rather than the raw API response, so no API-shape knowledge or fetch
logic exists in client-bundled code. `error.tsx` is also `'use client'`, because Next requires
error boundaries to be.

---

## 3. The chart is built from visx primitives, not a chart library with a "band" mark

### Decision

`TrendChart` composes `@visx/shape`'s `AreaClosed`, `LinePath` and `Circle`, `@visx/axis`,
`@visx/scale`, `@visx/responsive`'s `ParentSize`, and a hand-written nearest-point tooltip
(`src/lib/chart/hover.ts` plus `@visx/tooltip`).

### Alternatives considered

**Recharts** — composable JSX, the most common React charting choice, and a working version would
have come together faster. Rejected because its real time axis requires a numeric domain with
manual epoch-millisecond handling, its band needs array-valued `Area` data, and separating history
from forecast needs one merged dataset threaded with `null`s to split the two series — the time
saved on the happy path is spent fighting the abstraction on exactly the three things this chart is
made of.

**ECharts** — the most capable option, and its `dataZoom` would give a future
1W/3M/6M/1Y/ALL range selector for free. Rejected for this milestone: a large bundle, an imperative
option-object API that fights React's data flow, and weaker practical type safety and accessibility
than the alternatives — not justified for roughly 330 points with no realised need for pan/zoom yet.

**Chart.js, Plotly, Nivo, Observable Plot** — discounted on some combination of band composition,
bundle size, or React ergonomics, without a redeeming feature strong enough to revisit given the
above.

### Why visx fits this project specifically

No library ships a "forecast band that widens" primitive, so every option requires composing marks
by hand regardless — the real choice is which primitives to compose. visx exposes d3's scales and
shapes as plain React components with no owned state and no imperative escape hatch, so the same
`xScale`/`yScale` drive the axes, the marks and the tooltip's hit-testing, and nothing here needs a
performance feature visx lacks: 330 points need no canvas rendering, virtualisation or
downsampling, verified directly (the largest demo response, `reversal`, is 140 observations plus a
91-point forecast path, and the whole `gradual-loss` payload is 45 KB).

### The history/forecast join

`trajectory` ends at `last_observation_timestamp`; `forecast.path[0]` sits at `origin_timestamp`,
`lead_days` later, with a slightly different `w_kg` — the same state, propagated forward through
real elapsed time (ADR-0005). `buildChartSeries` (`src/lib/chart/series.ts`) prepends the last
history point to the forecast line and band, so the two segments share a vertex and the rendered
line has no gap over that lead period. This is tested directly
(`src/lib/chart/__tests__/series.test.ts`) rather than left as a rendering detail, because it is
easy to get subtly wrong and a test that only compared two rendering branches could pass while both
were wrong.

### What was deliberately not built

The 1W/3M/6M/1Y/ALL range selector, pan/zoom, and canvas rendering. None is free, and none is
needed at this data scale; visx does not block adding them later, but building them now would be
solving a problem Milestone 3 does not have.

---

## 4. CORS is still not configured — the reason from ADR-0006 has not changed

### Decision

`app/main.py` has no CORS middleware. `HEALTHTREND_ALLOWED_ORIGINS` does not exist. This was
re-examined, not merely carried over: the original M3 proposal was to add a narrow
`localhost:3000`-only policy on the grounds that "this is the correct milestone to decide it." On
review, that reasoning does not hold given what was actually built.

### Why not

Every request this frontend makes to the backend originates in a Next.js **server component**,
never in the browser (decision 2, above). A server-to-server HTTP request is not subject to the
same-origin policy — CORS is a *browser* enforcement mechanism, checked by the browser before it
lets page script read a cross-origin response. There is no page script here making that call, so
there is no preflight, no `Origin` header check, and no scenario in which the absence of a CORS
policy blocks anything this milestone does.

Adding a policy anyway — "ready for when the browser calls it directly" — would be exactly the
speculative configuration ADR-0006 already rejected once, this time with a slightly more plausible
excuse. It would sit untested (nothing in this milestone exercises it) and undecided (M3 does not
know the real deployed frontend origin, only `localhost:3000`), which is precisely the combination
ADR-0006 identified as the failure mode: configuration written for a need that has not arrived yet,
shipped without the review that a working feature would get.

### When this will need revisiting

The moment a real requirement introduces browser-to-backend traffic — a client-side upload
progress indicator, a future real-data submission form calling `POST /api/analyse` directly from
the browser rather than through a server action, or any other feature that puts `fetch` in a
component marked `'use client'` and pointed at the backend — CORS needs a real answer at that
point, against the actual deployed origins, not a guess made now. Recorded here so that decision is
made deliberately rather than being copied from this ADR without re-reading it.

---

## Consequences

Good: the TypeScript surface cannot silently drift from the backend contract; the frontend has no
state-management code to maintain, review or explain; the chart owns exactly the marks the product
needs and nothing it doesn't; and the backend gained zero attack surface and zero speculative
configuration from this milestone.

Cost: the chart is roughly 250 lines of hand-composed SVG rather than a few JSX props, and its
tooltip and hover logic needed a manual `ResizeObserver` polyfill and RTL cleanup fix to test at all
(both in `frontend/vitest.setup.ts`, documented there). Generated types must be regenerated
deliberately when the contract changes — CI catches a missed regeneration, but it is still a step a
contributor must remember to run locally. CORS being absent means the day a browser needs to call
the backend directly, that work starts from zero rather than from a policy already in place — judged
an acceptable trade against shipping an unexercised, unreviewed configuration today.

Related: [ADR-0005](ADR-0005-forecast-origin-and-interval-space.md),
[ADR-0006](ADR-0006-http-boundary.md), [ADR-0007](ADR-0007-demo-scenarios.md)

# ADR-0009 — The real-data browser boundary: direct submission, CORS, and honest presentation

**Status:** accepted, Milestone 4
**Implements:** master plan §12, §42, §79; extends [ADR-0006](ADR-0006-http-boundary.md) and
[ADR-0008](ADR-0008-frontend-contract-and-cors.md)

## Context

Milestone 3 built a frontend that never puts real data anywhere near a browser: every request runs
server-to-server, from a Next.js server component to FastAPI, and ADR-0008 §4 declined to configure
CORS on exactly that basis — there was no browser client, so any origin policy written then would
have been a guess. Milestone 4 is the case ADR-0008 named as the trigger for revisiting that: a user
can now type their own measurements into `/analyse` and submit them for analysis, and the entered
values are real health data, not synthetic. Four decisions follow from that, and each is easy to get
wrong in a way that only costs something later.

---

## 1. The browser calls FastAPI directly; nothing proxies through the Next.js server

### Decision

`AnalysisWorkspace` (`'use client'`) calls `submitAnalysis` (`src/lib/api/browserClient.ts`), which
issues `POST /api/analyse` straight from the browser to FastAPI. No Next.js server action or route
handler sits in between. This is the one deliberate exception to Milestone 3's "every fetch happens
in a server component" rule, not a reversal of it — the demo path (`src/lib/api/client.ts`,
`src/app/demo/[scenario]/page.tsx`) is untouched.

### Why not proxy through Next.js

A proxy avoids CORS entirely, and that is a real cost of this decision, paid in section 2 below. But
a proxy also adds a second server process that a raw measurement passes through before reaching
FastAPI — one with no audited no-logging, no-storage guarantee today, unlike FastAPI's
(`docs/privacy.md`, `backend/tests/api/test_privacy.py`, sentinel-value tests). A privacy notice
claiming "sent for this analysis and not stored" would then describe two server hops instead of one,
and the second would need the same scrutiny the first already has. Direct submission keeps real data
touching exactly one server: the one already proven not to log or retain it. Fewer hops, fewer things
to audit, a privacy notice that describes reality in one sentence — the smaller and more honest
boundary, and the one `architecture.md`'s "Where later work attaches" table already anticipated
("a submit form calling `POST /api/analyse`; CORS for that browser origin").

### What this is not

Not on-device analysis. The measurement leaves the browser, once, over HTTPS, and FastAPI computes
the estimate — exactly as it does for demo scenarios. The privacy notice on `/analyse` says this
plainly rather than implying local computation, and does not say "securely" unqualified: HTTPS and
no-retention are the actual claims Milestone 4 makes; deployment-level hardening is a separate,
later concern this milestone does not decide.

---

## 2. CORS: necessary now, for a reason ADR-0006 and ADR-0008 did not have

### Decision

`app/main.py` registers `CORSMiddleware`. Origins come from `HEALTHTREND_ALLOWED_ORIGINS`
(`app/config.py`), **fail-closed** — unset or empty means no origin is permitted, never "permit
everything". No wildcard is ever emitted. `allow_credentials=False`, because nothing in this system
has a cookie or a session to protect (master plan §42: no accounts in V1) and enabling it would be
unused surface. `allow_methods=["POST"]`, `allow_headers=["Content-Type"]` — exactly what
`submitAnalysis` sends.

### Why this is not the speculative configuration ADR-0006 rejected

ADR-0006 and ADR-0008 both rejected CORS on the same grounds: no browser client existed, so any
origin written into code would be a guess, and a permissive policy added "for later" is exactly the
kind of thing that ships unreviewed. Two things are different now. First, a browser client exists and
calls this API today, so the question is no longer hypothetical. Second, the allow-list is a
deploy-time **environment variable** with a fail-closed default, not a value hardcoded for a guessed
origin — an unconfigured deployment gets no CORS access at all rather than a wrong one. That is the
qualitative difference: a guess baked into source versus a decision deferred, correctly, to whoever
actually knows the deployed origin.

### Middleware ordering: CORS must wrap the logging middleware

`register_request_logging` is registered before `CORSMiddleware` is added. Starlette makes the
**most recently added** middleware outermost (`add_middleware` prepends to `user_middleware`, and the
stack wraps in reverse), so this ordering puts CORS outside the logging middleware. That matters
because `log_request` (`app/api/logging.py`) catches any unhandled exception itself and returns the
fixed 500 body directly, without re-raising — this is the application's normal backstop, not an edge
case. If CORS were registered *before* logging (and therefore wrapped *by* it), that 500 would leave
the process without a CORS header, and a browser would report an opaque network failure instead of
the actual — safe, curated — error body. `backend/tests/api/test_cors.py` pins this by forcing that
exact backstop and asserting the header survives it, alongside the ordinary 200 and 422 cases.

### What CORS does not do

CORS restricts which origins a *browser* may let page script read a response from; it is not a
firewall and it authenticates nothing. Any HTTP client that does not care about the header — `curl`,
a script, another server — can still call `POST /api/analyse` whether or not its origin is on the
list. That has always been true of this API and is unchanged by this milestone; the privacy
guarantees that matter (no storage, no logging of values) live at the application layer, not in CORS.

---

## 3. `NEXT_PUBLIC_HEALTHTREND_API_URL` is public by design, and is build-time, not runtime

### Decision

The browser needs to be told where to send its request, so a second, explicitly public environment
variable exists: `NEXT_PUBLIC_HEALTHTREND_API_URL`, read only inside `browserClient.ts`. The existing
`HEALTHTREND_API_URL` (server-only, read in `src/lib/config.ts`) is untouched, and the demo path
still never exposes it — that privacy property from `docs/privacy.md` continues to hold for the demo
path specifically.

### Why exposing it costs nothing beyond what direct submission already spent

A URL is configuration, not a secret: the moment the browser makes the request, the URL is visible in
its network inspector regardless of how the frontend learned it. Naming it explicitly in a
`NEXT_PUBLIC_` variable adds no new exposure over the alternative of hardcoding it in client-bundled
code — direct browser submission (decision 1) is what made the URL browser-visible; this variable is
just how Next.js's existing convention supplies it.

### Why this is a build-time value, not a request-time read

Next.js inlines `NEXT_PUBLIC_*` variables into the client bundle when `next build` runs, not when the
server later starts. A deployment must therefore supply this variable to the **build step**, not only
to whatever process runs the server afterward — unlike `HEALTHTREND_API_URL`, which the server reads
fresh on every request. This is recorded here because it is the kind of distinction that is invisible
until a deployment gets it backwards.

---

## 4. Zero-span presentation: `span_days === 0`, not a reading count

### Decision

`AnalysisWorkspace` renders the full result — `Headline`, `RateReadout`, `TrendChart`,
`ForecastCallout` — whenever `result.span_days > 0`. When `result.span_days === 0`, it renders only
`Headline` plus a fixed line, "Trend not established yet.": `RateReadout`, `TrendChart` and
`ForecastCallout` are not rendered at all.

### Why `span_days`, not `n_obs === 1`

ADR-0003 established that a single observation leaves velocity exactly at its prior: `v = 0`,
`v_sd = σ_v0`, unshrunk. But that is equally true of any batch whose entries share one instant —
ADR-0004's keep-everything ingestion permits exactly that, and two same-instant readings still yield
`n_obs = 2` with the identical degenerate posterior. `span_days` (`elapsed_days` from the first
observation to the last, already published on every response) is zero in both cases and only in
these cases, so it is the exact structural condition, not an approximation of one. `Headline` still
renders unconditionally, because the estimated weight *is* the honest posterior at `n = 1` — `R_0`,
the exact result of one Gaussian measurement (ADR-0003) — while a rate or forecast built from an
unshrunk prior would present that prior as if it were a finding, which is exactly the false precision
master plan §12 forbids.

---

## 5. Persistence remains entirely out of scope

### Decision

Nothing this milestone adds writes to `localStorage`, `sessionStorage`, IndexedDB, a cookie, or the
Cache API. Entered rows live only in `MeasurementForm`'s component state for the duration of the
visit. `frontend/src/lib/privacy/__tests__/no-persistence.test.ts` enforces this by scanning
`frontend/src` for each mechanism, the same "checked, not just documented" standard
`docs/privacy.md` already applies to the rest of the frontend.

This is a restatement of existing policy, not a new one — recorded here because it is the property
that makes "your measurements are sent for this analysis and are not stored" true, and because it is
the first milestone where that sentence has anything real to guarantee.

---

## Consequences

Good: the privacy notice on `/analyse` can state, in one honest sentence, exactly what happens to a
measurement; FastAPI gains a narrow, environment-configured, fail-closed CORS surface instead of a
guessed or wildcard one; the CORS-header-survives-the-backstop property is pinned by a test rather
than left to review; the zero-span rule reuses a field the backend already publishes, so no new
backend surface exists to get wrong.

Cost: `app/main.py` now depends on process environment for the first time, which is a small, real
increase in what a deployment must configure correctly (documented in `.env.example` on both sides).
`browserClient.ts` duplicates `client.ts`'s small error-body parser rather than sharing it, because
the two resolve their base URL from different environment variables with different visibility, and
merging them was judged more likely to fail silently than the duplication was to drift.

Related: [ADR-0003](ADR-0003-initialization.md), [ADR-0004](ADR-0004-multiple-observations-per-day.md),
[ADR-0006](ADR-0006-http-boundary.md), [ADR-0008](ADR-0008-frontend-contract-and-cors.md)

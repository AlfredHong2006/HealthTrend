# Privacy

HealthTrend handles body-weight measurements. Those are health data. Real measurements never enter
this repository, and they reach a HealthTrend server only when a person sends them there.

HealthTrend has two surfaces with different privacy shapes, and this document keeps them apart:

- **The public analysis routes** (`/v2/*`, and V1 at `/demo/*` and `/analyse`) are stateless. A
  measurement sent to them is analysed inside the request and not kept.
- **The signed-in beta app** (`/app`) stores an account's measurements, display preference and goal
  so the person can come back to them. What it stores, why, and how to get it out or delete it is
  described under [The signed-in beta app](#the-signed-in-beta-app).

This document is the operational form of the project's privacy and health-framing rules.

## Never committed

`.gitignore` blocks these from the first commit onward, before any data file could exist:

| Pattern | Why |
| --- | --- |
| `private/`, `real_data/`, `apple_health_export/` | conventional locations for real exports |
| `*.xml` | Apple Health exports are XML |
| `export*.zip`, `*.zip` | the Apple Health export is a zip |
| `*.csv` except under `sample_data/` | any CSV is assumed to be real measurements unless it is explicitly synthetic |
| `.env`, `.env.*` | credentials |

Real Apple Health exports belong outside the repository tree, or under `private/`.

Verify before any commit that no file matching these patterns is staged. All Git operations in this
project are performed by the developer, never by tooling.

## Only synthetic data is committed

Every committed dataset is generated, not measured. `testing/synthetic.py` enforces this at the type
level: `SyntheticSeries.__post_init__` raises unless the scenario label contains the word
"synthetic", so a generated series cannot be mistaken for real measurements. The committed golden
fixture carries its generator, seed and scenario parameters in a `_scenario` block, and test
`A2` asserts the label says synthetic.

## Health data never reaches a log

The numerical core cannot log. `print`, `open` and friends are forbidden in `app/core` and the ban is
enforced by `tests/core/test_architecture_purity.py`. There is no logging framework in the core at
all.

Error messages name positions and field names, never values. For example
`UnsortedObservationsError` reports "the observation at position 2 precedes the one at position 1" —
no weight, no timestamp. Test `F8` asserts that none of the input weights and no year appears in the
message, because an exception string is exactly the kind of thing that ends up in a log aggregator.

## The same rule at the HTTP boundary

The core cannot leak a measurement because it cannot log. One layer up, the data actually arrives, so
the rule has to be enforced rather than implied. ADR-0006 records the decisions; this is what they
mean operationally.

**Request logs carry counts, never contents.** `app/api/logging.py` records the method, the matched
route template, the status, the duration and the number of observations analysed. The middleware
**never reads the request body** — not to count observations, not to check a size. A route that has
already validated its input records the count via `record_observation_count`, and the middleware picks
it up afterwards. Parsing a body in a logging path is how a weight reaches a log line by accident.

**No application logger ever records a caller-controlled route value.** The access log writes the
matched route *template* (`/api/demo/{scenario}`), never the raw path — even a matched path embeds
whatever the caller typed into a parameter, and an unmatched path is an arbitrary string (those log
as `<unmatched>`). The error handlers log only fixed metadata: a public error code, a field-problem
count, an exception class name. Nothing derived from the request URL appears in any
`healthtrend.*` record.

**Validation errors are rebuilt, not filtered.** Pydantic's error detail carries `input`: the
offending value. Removing that key is not enough, because `msg` is generated text too. So the public
message is looked up by the machine-readable error `type` from a table of our own strings, and only
`location`, `code` and that message are published. Locations are filtered to integer indices and
plain identifiers, because with `extra="forbid"` an unknown *field name* comes from the request body
and a caller controls field names.

**Domain and core errors are looked up in a table.** Never `str(exc)`, never a class name. An
unmapped exception becomes a fixed 500 with no detail and no traceback in the body.

**Unexpected exceptions are converted, and their messages are never logged.** A third-party
exception message can quote a value (Pydantic's own errors embed the offending input), so the
request middleware catches anything unhandled, logs one line carrying the exception **class name**
only — no message, no traceback — and returns the fixed 500 itself. Converting in the middleware is
what keeps the traceback out of the *server's* logs too: Starlette deliberately re-raises after a
registered catch-all handler runs, and uvicorn would then print the full traceback to `uvicorn.error`.
The accepted cost is that diagnosing an unexpected failure means reproducing it, not reading its
message out of a log.

**Residual channel, stated honestly.** If the logging middleware itself fails, the backstop handler
in `app/api/errors.py` fires, Starlette re-raises, and the ASGI server logs the full traceback on its
own logger. That channel cannot be closed from inside the application; it is reachable only through a
bug in a dozen lines of our own middleware code, which never handles measurement values.

**Uvicorn's access log is disabled as hardening, not because it leaks weights today.** It records
request lines — method, raw path, query string — never JSON bodies, and this API carries measurements
only in bodies. But raw paths are caller-controlled strings, this application's own access log
already records the safe equivalent, and a metadata log nobody reads is pure liability. Run with
`--no-access-log`. This is deployment configuration, and therefore a weaker guarantee than the rest;
the documented start command in [deployment.md](deployment.md) includes it.

All of this is enforced by [`backend/tests/api/test_privacy.py`](../backend/tests/api/test_privacy.py),
which submits a sentinel weight *and* a sentinel timestamp — through the body, through a matched
route parameter, and inside an injected exception message — and asserts that neither appears in a
validation response, a domain-error response, a 500 body, or any application log record.

The same rules cover the account routes (`/api/auth/*`, `/api/me/*`). The sentinel tests extend to
them: a stored measurement is walked through create, list, analyse and both exports, and a failing
batch import, a future-dated stored reading and a 404 naming a measurement id are all checked. No
weight, timestamp, email address, sign-in code, session token or account id appears in any response
body it should not, or in any application log record. Every account and sign-in response carries
`Cache-Control: no-store`.

## The public analysis routes store nothing

`POST /api/analyse`, `POST /api/ingest/csv` and the demo routes keep nothing. The analysis happens
inside the request and the result is returned; nothing about it is written to the database, a
session, a cache or a file, and there is no telemetry. The CSV upload is never retained (see
[below](#csv-import-milestone-5)).

Three frontend paths reach those routes: the built-in synthetic demo scenarios, manual measurement
entry, and CSV import. They have different privacy shapes in the *browser*, described below. On the
server they are indistinguishable — the same stateless request, whichever page issued it, and the
same guarantee regardless. Using them needs no account, and they read no session cookie.

The same server process also serves the signed-in beta app, so it now needs a database to start.
That changes where the server's configuration comes from, not what the public routes keep: they
still never read from or write to it.

## The signed-in beta app

`/app` is a separate, private-beta surface for people who want to come back to their history. It is
not linked from the public routes, and signing in is passwordless: an emailed six-digit code, then a
session. Everything below is implemented; nothing is a plan.

### What is stored, and why

| Stored | Why |
| --- | --- |
| The account's email address (lower-cased), when the account was created, and when it last signed in | it is the account's identity and where sign-in codes are sent |
| Sign-in codes: the email address they were sent to, an HMAC of the code (never the code itself), when it was issued, when it expires, whether it was used, and failed attempts | to check a code once and enforce expiry, attempt and rate limits |
| Sessions: a SHA-256 hash of the session token (never the token itself), and when the session was created, last used and expires | to recognise a signed-in browser |
| Measurements: timestamp, weight, the unit it was entered in, whether it was entered by hand or imported from CSV, and when the row was created and last changed | they are the history the analysis is computed from |
| The display unit (kg or lb) | so the choice is remembered |
| The current goal, if one is set: a target weight and/or a target weekly rate | so it can be shown beside the estimate |

Nothing else is stored for an account: no name, no password, no device identifier, no location, no
analysis result (the analysis is recomputed from the stored measurements on every request), and no
history of past goals.

**A goal never reaches the estimate.** The account analysis reads stored measurements and the clock,
and nothing else; setting, changing or removing a goal leaves the analysis byte-for-byte identical,
and a regression test sweeps goal values to prove it
([ADR-0012](decisions/ADR-0012-accounts-and-persistence.md)).

A sign-in code expires after 10 minutes and allows five attempts; at most three are issued per
address in 15 minutes. A session lasts about 90 days from when it was last used (the expiry moves
forward at most once a day), so a person who keeps using the app stays signed in and one who stops is
signed out after 90 days. Signing out deletes the session.

**Old authentication rows are not yet swept on a schedule** — a beta limitation. An expired session
stops working at expiry but its row is deleted only when that cookie is presented again, or with the
account. Sign-in code rows older than the 15-minute window are deleted when the same address next
requests a code, or with the account. So an address that requests a code and never signs in stays in
the sign-in code table, with its expired code HMAC, until it requests another code; it creates no
account.

### The session cookie

The browser holds one cookie, `ht_session`, set by the API when a code is verified. It is
`HttpOnly`, so no script on any page can read it, including HealthTrend's own; `Secure` in every
deployed configuration, so it is only sent over HTTPS; `SameSite=Lax`; and scoped to the API host.
It carries a random token and nothing else. The frontend never reads, writes or stores a token of its
own, and uses no `localStorage`, `sessionStorage`, IndexedDB, Cache API or `document.cookie` for
account state — the same static guard described below enforces that for `/app` too. Signed-in data
lives only in page memory while it is on screen, and is fetched again from the API on the next
visit.

### Getting data out

Settings offers two separate downloads, and they are different on purpose:

- **Measurements (CSV)** — `timestamp,weight,unit`, one row per stored measurement, in exactly the
  shape HealthTrend's CSV import accepts, so it can be imported again. It contains measurements
  only: no goal, preference or account details.
- **Account data (JSON)** — a versioned file of the account data HealthTrend stores: the account's
  id, email address and creation time, the display preference, the goal (or none), and every
  measurement with its source and row timestamps. It contains only what HealthTrend itself holds.
  It leaves out the authentication records — sign-in code HMACs, session hashes and the last
  sign-in time — which are about signing in rather than the person's data.

### Deleting an account

Deleting an account from Settings, after retyping its email address, removes it immediately and
permanently from HealthTrend's database: the account row, and with it every session, measurement,
preference and goal. Sign-in codes are not linked to the account row, so they are purged separately
by email address, including a code requested moments before deletion. The session cookie is
cleared, and a copy of it taken earlier stops working. There is no soft delete, no undo and no
retention period implemented by HealthTrend.

What deletion does not reach, stated plainly:

- **Provider backups.** The database runs on a managed Postgres provider, which keeps its own
  backups and point-in-time recovery history on its own schedule. Deleted rows can persist there
  until that history expires. HealthTrend does not control that retention and does not claim
  deletion from it is immediate.
- **Email already sent.** A sign-in code email, and the delivery records the email provider keeps
  about it, are outside HealthTrend's database.
- **Exports already downloaded.** A file saved to a device stays there.

Otherwise, account data is kept until the account is deleted. There is no automatic expiry of
measurements, and no inactivity deletion.

### What is not claimed

HealthTrend makes no legal or regulatory compliance claim for the beta, and holds no certification.
This section describes what the software does; it is not a legal agreement.

## The frontend

The demo path — the five built-in synthetic scenarios — carries no real data at all: no upload
control, no form, no file input, and nothing in `src/app/demo/**` writes to `localStorage`,
`sessionStorage`, IndexedDB or a cookie.

The own-data pages (`/analyse`, `/v2/analyse`) and the signed-in `/app` are the only places real
health data can exist in the frontend, and they are held to the same "nothing needs it, which is
stronger than a policy forbidding it" standard, enforced directly by a static guard,
`frontend/src/lib/privacy/__tests__/no-persistence.test.ts`, which fails the build if
`localStorage`, `sessionStorage`, IndexedDB, `document.cookie`, the Cache API or
`navigator.storage` appears anywhere under `frontend/src`. `/app` keeps its data on the server, not
in the browser: a signed-in page holds what it fetched in component state while it is open. `/app`
has no service worker and no offline storage. Entered and imported measurements live
only in that page's component state for the duration of the visit; there is no draft-saving, no
restore-on-reload, and reloading or navigating away leaves nothing behind.

**This is not on-device analysis.** Measurements are sent, once, over HTTPS, to the FastAPI backend,
which computes the estimate — exactly as it does for demo scenarios. That is true of typed rows and
of an imported CSV file alike: the file is read in the browser only far enough to be uploaded to
`POST /api/ingest/csv`, and the parsing happens on the server. User-facing copy on the page says so
plainly: *"Your measurements are sent to the HealthTrend analysis service for this analysis and are
not stored... Importing a CSV file works the same way: the file is read once, to produce measurements
for this analysis, and is not kept afterwards."* It does not claim the data stays on the device, and
it does not claim more security than is actually provided (HTTPS transport and no server-side
retention; deployment-level hardening is a separate, later concern).

- **No analytics, telemetry, advertising or third-party script**, on any path. There is one
  third-party request: the V2 routes and `/app` load their typefaces from Google Fonts
  (`fonts.googleapis.com`, `fonts.gstatic.com`), imported by `src/app/v2/v2-tokens.css`. That
  request carries the visitor's IP address and user agent to Google, as any font request does, and
  no measurement or account data. The V1 routes load no third-party resource. Nothing else in
  `frontend/` loads a script, font, stylesheet or tracking pixel from any origin other than this
  app's own and the configured backend.
- **The backend URL reaches the browser only for the manual-entry path, and only because it must.**
  The demo path is unchanged: every demo fetch happens in a Next.js server component
  (`src/app/demo/[scenario]/page.tsx`), `HEALTHTREND_API_URL` is read server-side only, and it is
  still deliberately not prefixed `NEXT_PUBLIC_`. The manual-entry page issues its `POST
  /api/analyse` request directly from the browser, so the browser must be told where to send it: a
  second, distinct variable, `NEXT_PUBLIC_HEALTHTREND_API_URL`, is read only inside
  `frontend/src/lib/api/browserClient.ts`. This is a Next.js **build-time** value baked into the
  client bundle, not a per-request runtime read — a production deployment must supply it to the
  frontend build, not just to the running server. It is configuration, not a secret: any visitor's
  browser reveals the URL it is calling the moment it makes the request, with or without a
  `NEXT_PUBLIC_` variable to carry it, so naming it explicitly costs nothing that direct browser
  submission had not already spent. See [ADR-0006](decisions/ADR-0006-http-boundary.md) and
  [ADR-0008](decisions/ADR-0008-frontend-contract-and-cors.md) for why direct-to-backend submission
  was chosen over proxying through the Next.js server, and the narrow, fail-closed CORS configuration
  (`HEALTHTREND_ALLOWED_ORIGINS`) that decision requires on the backend.
- **Demo responses are never cached.** `cache: "no-store"` on every fetch, because demo data is
  generated relative to the current instant (ADR-0007) and the same URL legitimately returns
  different data on every request — caching it would be a correctness bug before it was a privacy
  one, but it also means no response is retained anywhere between requests. The manual-entry
  submission is a `POST`, which browsers never cache by default, and no caching header is added to
  its response.
- **The committed test fixtures are synthetic.** `frontend/src/lib/api/__fixtures__/gradual-loss.json`
  is a captured demo response; its `meta.source` is `"demo"` and its label says "synthetic", the same
  rule this document already applies to `backend/tests/fixtures/`. Nothing under `frontend/` fixtures
  a real measurement — the manual-entry tests use invented numbers, the same way the backend's do.

## CSV import (Milestone 5)

CSV weight-history import (`POST /api/ingest/csv`, [ADR-0010](decisions/ADR-0010-csv-ingestion.md))
follows the same rules above, plus its own:

- **The upload is never written to disk by this application.** The route reads the request body
  as a raw, capped byte stream rather than `multipart/form-data`. That is a real constraint, not
  a preference: Starlette's multipart parser spools any file part above 1 MiB to a genuine
  on-disk temporary file (`tempfile.SpooledTemporaryFile`), which would make a "never touches
  disk" claim false for any file over roughly a megabyte. The raw-body path never invokes that
  parser at all, so this guarantee holds regardless of file size, up to the byte cap. It is an
  application-level guarantee — it says nothing about OS paging or infrastructure outside this
  codebase's control.
- **Only the recognised columns are read.** A CSV row is tokenised like any other by ordinary CSV
  parsing, but only the timestamp, weight and (optional) unit columns are ever interpreted.
  Anything else — a `notes` or `source` column some export tools add — is ignored immediately:
  never semantically read, never returned to the browser, never logged, never persisted, never
  forwarded to `/api/analyse`.
- **No row counts are logged.** Unlike `/api/analyse` and `/api/demo/{scenario}`, this route never
  calls `record_observation_count`. How many measurements someone is importing is itself
  health-adjacent metadata, and the parse report already reaches the caller directly — there is
  no operational need served by also writing it to a log.
- **Error messages never echo a submitted value, including the timezone.** A malformed row's
  message names only a stable reason code (e.g. `unparseable_timestamp`), never the cell that
  caused it. An invalid `assumed_timezone` query parameter is rejected the same way, kept
  consistent with the blanket policy above rather than treated as a special, lower-sensitivity
  case.
- **The frontend makes no new persistence surface.** `CsvImport` holds the selected `File` and the
  parse report only in React component state, the same as `MeasurementForm` holds typed rows; the
  existing `no-persistence.test.ts` static guard already covers it, unchanged.
- **Importing into an account is a second, explicit step.** On `/app/import` the same parse runs
  first, statelessly, and is shown for review. Only the accepted rows are then stored, by a separate
  request (`POST /api/me/measurements/batch`), when the signed-in person confirms. A row matching a
  measurement already stored for that account is skipped rather than stored twice.

## Not a medical device

HealthTrend estimates and forecasts a measurement trend. It does not diagnose, treat, prescribe or
explain physiology.

The language in code, docs and UI stays hedged for a reason: *estimated*, *likely*, *consistent with*,
*association*, *uncertainty*. Avoid *caused by*, *definitely*, *medically healthy*. The core supports
this by reporting distributions rather than point claims, and by being willing to produce an interval
so wide it says nothing — which is the correct output from one measurement, not a failure.

## Claims

Only claim what is implemented and measured. As of Milestone 6:

- the model parameters are documented priors, not values fitted to data
- **no real health data has been used for any evaluation.** Milestone 6 ran five experiments; every
  one of them is a simulation.
- there is no robustness to outliers. The sensitivity is measured and recorded, and Milestone 6 adds
  a coverage number for it: on 5% contaminated readings the one-step 95% interval covers 88%.
- **Milestones 2 to 5 changed no mathematics**, and neither did Milestone 6. Each put the existing
  estimator behind something new — HTTP, a browser, manual entry, CSV import, then a measuring
  instrument. The golden fixture from Milestone 1 is still byte-identical, which is the evidence.
- **Milestone 8 (the signed-in beta) changed no mathematics either.** An account's analysis is the
  same service call a submitted series makes, and a test asserts the two responses are identical
  apart from `meta.source`. None of Milestone 7A's research candidates — an on-plan probability,
  departure detection — is product-eligible, and none reaches the API or either frontend
  ([evaluation/m7a_report.md](evaluation/m7a_report.md)).
- the frontend renders numbers the backend computed and interprets none of them; it does not label
  anything "high confidence", "plateau" or "likely to continue" unless that classification exists as
  a defined backend result, which it does not yet

Milestone 6 measured the estimator. What it established, with the numbers in
[evaluation/results.md](evaluation/results.md) and the reading in
[evaluation/report.md](evaluation/report.md):

- the log-likelihood and forecast moments are arithmetically correct. The two recursions agree
  across all 810 cases of the battery; an independent computation adjudicated 781 of them and
  agreed; the remaining 29 are ill conditioned for that computation, and an exact-arithmetic spot
  check kept as a permanent test supports the diagnosis that the double-precision oracle, not the
  filter, is the party losing accuracy there
- on synthetic data drawn from the model's own assumptions, the 95% intervals cover about 95% of the
  time — for latent weight and for velocity, over 500 series on a regular schedule and 500 more on
  an irregular one
- irregular weigh-in spacing costs no calibration, as the process-noise construction claimed
- the process-noise parameter is not identifiable from a month of data at any weighing frequency,
  which is a measured argument against fitting parameters per user
- the initial-velocity prior materially affects reported uncertainty for roughly the first ten
  readings and is negligible by thirty

And what it established that is *unflattering*, which belongs here just as much:

- **the estimator is not uniformly better than a moving average.** On a flat trajectory its 30-day
  forecast is about seven times worse; on a plateau, about six times worse. In both cases it
  extrapolates a velocity that is mostly noise.
- **and it is not uniformly better than the tuned alternatives either.** On the 30-day metric a
  tuned Holt beats it in six of E5's eight regimes and a Kalman filter fitted to the regime in five,
  including the ordinary steady-loss regime. No method in that comparison wins everywhere, the
  shipped estimator included, and every baseline was tuned on the shape it was then tested on.
- **the intervals are calibrated when the model holds and are not when it does not.** On a genuine
  level shift the 30-day interval covers the truth 48% of the time against a nominal 95%. On
  deterministic trajectories it over-covers at 100% — too wide rather than too narrow, which is the
  safer failure but is still not calibration.

So: the *implementation* is validated, on synthetic data, and said so precisely. The *model* is not,
and Milestone 6 found specific regimes where it is the wrong one. Do not describe the system as
accurate or robust; do not describe its intervals as calibrated without saying on what. Nothing here
licenses a claim about real weight data, because no experiment has touched any.

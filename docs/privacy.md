# Privacy

HealthTrend handles body-weight measurements. Those are health data, and the default assumption is
that they never leave the machine they were measured on and never enter this repository.

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
`--no-access-log`. This is deployment configuration, and therefore a weaker guarantee than the rest —
revisit it when deployment is designed.

All of this is enforced by [`backend/tests/api/test_privacy.py`](../backend/tests/api/test_privacy.py),
which submits a sentinel weight *and* a sentinel timestamp — through the body, through a matched
route parameter, and inside an injected exception message — and asserts that neither appears in a
validation response, a domain-error response, a 500 body, or any application log record.

## No storage, no accounts

Nothing is stored. The analysis happens inside the request and the result is returned; there is no
database, no session, no cache, no telemetry, and no retained upload. `create_app()` wires routes,
error handlers, the access log and the CORS middleware described below — and nothing else. There is
no storage layer to configure, and therefore none to forget to secure.

Three frontend paths reach that one server: the built-in synthetic demo scenarios, manual
measurement entry, and CSV import. They have different privacy shapes in the *browser*, described
below. On the server they are indistinguishable — the same stateless request, whichever page issued
it, and the same guarantee regardless.

## The frontend

The demo path — the five built-in synthetic scenarios — carries no real data at all: no upload
control, no form, no file input, and nothing in `src/app/demo/**` writes to `localStorage`,
`sessionStorage`, IndexedDB or a cookie.

The `/analyse` page is the only place real health data can exist in the frontend — whether typed into
the form or read from an imported CSV file — and it is held to the same "nothing needs it, which is
stronger than a policy forbidding it" standard, enforced directly by a static guard,
`frontend/src/lib/privacy/__tests__/no-persistence.test.ts`, which fails the build if any of those
same four mechanisms appears anywhere under `frontend/src`. Entered and imported measurements live
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

- **No analytics, telemetry or third-party script**, on either path. Nothing in `frontend/` loads a
  script, font, stylesheet or tracking pixel from any origin other than this app's own and the
  configured backend.
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

## Not a medical device

HealthTrend estimates and forecasts a measurement trend. It does not diagnose, treat, prescribe or
explain physiology.

The language in code, docs and UI stays hedged for a reason: *estimated*, *likely*, *consistent with*,
*association*, *uncertainty*. Avoid *caused by*, *definitely*, *medically healthy*. The core supports
this by reporting distributions rather than point claims, and by being willing to produce an interval
so wide it says nothing — which is the correct output from one measurement, not a failure.

## Claims

Only claim what is implemented and measured. As of Milestone 5:

- the model parameters are documented priors, not values fitted to data
- calibration has been demonstrated only on data drawn from the model itself
- there is no robustness to outliers, and the sensitivity is measured and recorded
- no real health data has been used for any evaluation
- **Milestones 2 to 5 changed no mathematics.** They put the existing estimator behind HTTP, then
  behind a browser, then behind manual entry and CSV import. Nothing about accuracy, calibration or
  robustness improved, and the golden fixture from Milestone 1 is byte-identical — which is the
  evidence for that claim.
- the frontend renders numbers the backend computed and interprets none of them; it does not label
  anything "high confidence", "plateau" or "likely to continue" unless that classification exists as
  a defined backend result, which it does not yet

Do not describe the system as validated, robust, or accurate until there are experiments that say so.

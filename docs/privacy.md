# Privacy

HealthTrend handles body-weight measurements. Those are health data, and the default assumption is
that they never leave the machine they were measured on and never enter this repository.

Master plan §42 and §79 are the governing rules. This document is the operational form of them.

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
error handlers and the access log, and nothing else.

Master plan §42's public web version is arriving in stages. Milestone 3 delivers the synthetic-demo
half: no user upload yet, so there is nothing for this section to say about real data reaching the
frontend. Real-data upload and account-based tracking are separate later phases that need their own
privacy design first.

## The frontend

Milestone 3 uses only the five built-in synthetic demo scenarios. There is no upload control, no
form, no file input and no `localStorage`/`sessionStorage`/cookie anywhere in `frontend/` — not
because a policy forbids them, but because nothing in the frontend needs them yet, which is a
stronger guarantee than a policy.

- **No analytics, telemetry or third-party script.** Nothing in `frontend/` loads a script, font,
  stylesheet or tracking pixel from any origin other than this app's own and the configured backend.
- **The backend URL never reaches the browser.** Every fetch happens in a Next.js server component
  (`src/app/demo/[scenario]/page.tsx`); the `HEALTHTREND_API_URL` environment variable is read
  server-side only and is deliberately not prefixed `NEXT_PUBLIC_`.
- **Demo responses are never cached.** `cache: "no-store"` on every fetch, because demo data is
  generated relative to the current instant (ADR-0007) and the same URL legitimately returns
  different data on every request — caching it would be a correctness bug before it was a privacy
  one, but it also means no response is retained anywhere between requests.
- **The committed test fixtures are synthetic.** `frontend/src/lib/api/__fixtures__/gradual-loss.json`
  is a captured demo response; its `meta.source` is `"demo"` and its label says "synthetic", the same
  rule this document already applies to `backend/tests/fixtures/`.

## Not a medical device

HealthTrend estimates and forecasts a measurement trend. It does not diagnose, treat, prescribe or
explain physiology (master plan §79).

The language in code, docs and UI stays hedged for a reason: *estimated*, *likely*, *consistent with*,
*association*, *uncertainty*. Avoid *caused by*, *definitely*, *medically healthy*. The core supports
this by reporting distributions rather than point claims, and by being willing to produce an interval
so wide it says nothing — which is the correct output from one measurement, not a failure.

## Claims

Only claim what is implemented and measured (master plan §71). As of Milestone 3:

- the model parameters are documented priors, not values fitted to data
- calibration has been demonstrated only on data drawn from the model itself
- there is no robustness to outliers, and the sensitivity is measured and recorded
- no real health data has been used for any evaluation
- **Milestones 2 and 3 changed no mathematics.** They put the existing estimator behind HTTP and then
  behind a browser. Nothing about accuracy, calibration or robustness improved, and the golden
  fixture from Milestone 1 is byte-identical — which is the evidence for that claim.
- the frontend renders numbers the backend computed and interprets none of them; it does not label
  anything "high confidence", "plateau" or "likely to continue" unless that classification exists as
  a defined backend result, which it does not yet

Do not describe the system as validated, robust, or accurate until there are experiments that say so.

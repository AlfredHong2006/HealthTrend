# ADR-0006 — The HTTP boundary: the clock, the error surface, and what may be logged

**Status:** accepted, Milestone 2
**Implements:** master plan §42, §53, §71, §79; extends [ADR-0005](ADR-0005-forecast-origin-and-interval-space.md)

## Context

Milestone 1 is a library. Milestone 2 puts it behind four endpoints without loosening any of
the properties that made the library defensible: determinism, goal neutrality, and the fact
that the numerical core cannot leak a measurement because it cannot log at all.

Five decisions were needed, and each of them is easy to get wrong in a way that only shows
up later.

---

## 1. The API owns the clock; the core still never reads it

### Decision

`app/services/clock.py` defines a `Clock` protocol and a `SystemClock`. It is injected into
routes through `app/api/deps.py` as a FastAPI dependency, and it is the **only** place
production code reads the system time.

`POST /api/analyse` takes `forecast_from`, defaulting to `"now"`. That passes the clock's
instant to `run_analysis(origin=...)`, which is precisely the parameter ADR-0005 created.

### Why the default is "now" and not the last observation

ADR-0005 established that propagation runs over `τ = lead + horizon`. If the last weigh-in
was five days ago, a "30-day forecast" anchored to that reading is really a five-day-old view
of the future, and it understates uncertainty by five days of drift. Defaulting to `"now"`
is therefore the honest reading. `forecast_from="last_observation"` remains available for a
caller that genuinely wants the series-relative view, and the response publishes
`origin_timestamp`, `last_observation_timestamp` and `lead_days` so that no client has to
guess which question was answered.

### Why no test double ships in production

`FixedClock` lives in `tests/api/conftest.py`, not in `app/`. Production has no use for a
settable clock, and shipping one invites it to be used. Overriding the dependency is enough
to make every response — including both golden fixtures — reproducible.

### Consequence: a measurement in the future is rejected

With `forecast_from="now"`, an observation dated after the clock would give a negative lead.
The core already refuses that (`_lead_days` raises: forecasting into the past is a smoothing
problem, not a forecasting one), but it would surface as a generic core failure. So the
service raises `FutureObservationError` first and the caller gets `422
observation_in_the_future` with an explanation.

**No skew tolerance.** The comparison is strict: later than `now` is rejected, equal is
accepted. A user's device clock running two minutes fast will therefore be refused. That is
a deliberate simplification for this milestone, not a considered position on clock skew; a
tolerance would need a defensible size, and this is a decision worth making against real data
rather than by intuition. Recorded as a limitation.

---

## 2. Every error message comes from a table, never from an exception

### Decision

`app/api/errors.py` holds an explicit mapping from exception type to `ErrorSpec(status_code,
code, message)`. Lookup is by `isinstance` over an ordered table. Nothing is derived from
`str(exc)`, from an exception's class name, or from a Pydantic validator's generated text. An
unmapped exception becomes a fixed 500 with no detail.

One envelope for every failure:

```json
{"error": {"code": "...", "message": "...", "details": [{"location": "...", "code": "...", "message": "..."}]}}
```

### Why not derive codes mechanically from class names

It reads as elegant and it is a trap. A code derived from a class name means renaming an
internal exception silently changes the public API, and — more importantly — it means the
*next* exception type added anywhere below the boundary gets a public code and a public
message that nobody chose. Failing closed to a 500 forces the decision to be made
deliberately.

### Why the validation messages are replaced rather than filtered

Pydantic's error detail carries `input` — the offending value. For this product that is a
body weight in an error response, and from there in whatever aggregates the caller's logs.
Stripping `input` and `ctx` is necessary but not sufficient, because `msg` is also generated
text. So the message is looked up by the machine-readable `type` in
`_VALIDATION_MESSAGES`, with a generic fallback, and only `location`, `code` and our own
message are published.

Locations are filtered too. With `extra="forbid"`, an unknown *field name* appears in the
location path, and a caller controls field names: `{"77.7777": 1}` would otherwise echo
straight back. Components are kept only if they are integer indices or plain identifiers;
anything else becomes `<field>`. This mirrors the convention the core already follows —
`UnsortedObservationsError` names positions, never values.

Structural validation therefore lives in the schema, where its messages are safe, and any
rule needing to see the series as a whole lives in the service, where its message comes from
the table.

---

## 3. Request logging records what a request was, never what it contained

### Decision

`app/api/logging.py` logs method, matched route template, status, duration and — if the route
recorded it — the observation count. Nothing else.

**The middleware never reads the request body.** Not to count observations, not to enforce a
size. Parsing a body in a logging path is how a weight reaches a log line by accident, and it
would also consume the stream the route needs. A route that has already validated its input
calls `record_observation_count(request, n)`, and the middleware picks it up afterwards.

**The route template is logged, not the URL path — everywhere, including the error handlers.**
A path is a caller-supplied string: an unmatched one is arbitrary (logged as `<unmatched>`),
and even a matched parameterised one embeds whatever the caller typed into `{scenario}`. The
exception handlers therefore log no request-derived value at all — only the public error code
or a field-problem count; the access line supplies the method, template and status for the
same request. (The first implementation logged `request.scope["path"]` from the handlers,
which leaked a caller-controlled string into the application log through
`/api/demo/{scenario}`; a regression test now pins the fixed behaviour.)

**Unexpected exceptions are converted by this middleware, not merely observed.** Starlette's
outermost error middleware re-raises after any registered catch-all handler returns — by
design, so servers can see the failure — and uvicorn then writes the full traceback to its own
`uvicorn.error` logger. An exception message is not ours to trust: a Pydantic error quotes the
offending input. So the middleware catches anything unhandled, logs one line carrying the
exception **class name** only, and returns the fixed 500 itself; nothing propagates to
Starlette or the server. The handler registered for `Exception` remains as a backstop for a
failure of the middleware's own dozen lines — if it ever fires, the re-raise happens and the
server logs the traceback, a residual channel that cannot be closed from inside the
application and is recorded in `docs/privacy.md`. The accepted cost of never logging messages
or tracebacks is that diagnosing an unexpected failure means reproducing it.

### Known interaction: uvicorn's own access log

Uvicorn's built-in access logger records request lines — method, raw path, query string. It
never sees JSON bodies, and this API carries measurements only in bodies, so it is not a
weight channel today. It is still disabled (`--no-access-log`) as hardening: raw paths are
caller-controlled strings, and this middleware already records the safe equivalent. That is
deployment configuration, a weaker guarantee than the rest of this ADR; revisit it when
deployment is designed.

---

## 4. No size-limit middleware, and a count limit instead

### Decision

`AnalysisRequest.observations` is capped at 10,000 items by the schema. There is no
middleware inspecting `Content-Length` or buffering bodies to enforce a byte limit.

Ten years of weighing in five times a day is roughly 18,000 readings, so the cap comfortably
covers any real personal history while bounding the work one request can cause. Rejection is
on a count, and the message names the limit and nothing that was sent.

A byte-level limit belongs to the reverse proxy or the platform in front of the application,
not to a middleware that reads whole bodies — which would reintroduce exactly the hazard
decision 3 avoids. Deferred to deployment.

---

## 5. Timestamps are bounded so forecast arithmetic cannot overflow

### Decision

`ObservationIn.timestamp` is capped at `MAX_OBSERVATION_TIMESTAMP` (9999-01-01 UTC) in the
schema, rejected as an ordinary field-level validation failure.

The bound is arithmetic, not physiological. Python datetimes end at 9999-12-31, and a
forecast propagates the state up to 90 days past an observation, so a reading close enough
to that ceiling made `forecast_from="last_observation"` overflow inside the core's timestamp
arithmetic — a 500 manufactured from a syntactically valid request, plus a traceback per
request as a free log-flooding lever. Rejecting at validation names the offending field and
runs no arithmetic at all. The cap keeps `timestamp + 90 days` representable with almost a
year of margin, and the boundary value itself is accepted and tested end-to-end.

No lower bound exists: arbitrarily old timestamps only ever shift *forward* during
propagation, which cannot overflow, and rejecting them would be a data opinion this
milestone has no grounds for.

---

## Alternatives considered

**Returning FastAPI's default validation errors.** Rejected: they echo the input. This is the
single most likely way this project would have leaked health data.

**Letting the caller choose forecast horizons.** Rejected for this milestone. 7/30/90 are the
published product horizons (master plan §9); a free horizon parameter widens the contract
before anything has been calibrated, and 90 days is already at the edge of where a model with
no mean reversion means anything.

**Accepting model parameters in the request.** Rejected. The priors are unfitted (ADR-0003).
Exposing them as knobs implies an accuracy claim the project has not earned, and would invite
tuning until the answer looks nice. They are echoed in the response for transparency instead.

**Accepting a goal in the request.** Deferred with the rest of goal projection. Keeping it out
means the estimator's goal neutrality stays structural: there is still no argument, field or
config through which a preference could reach it (master plan §4).

**CORS configured now, "ready for the frontend".** Rejected. There is no browser client yet, so
any origin policy written today would be a guess, and a permissive one added for convenience is
exactly the kind of thing that ships unreviewed.

## Consequences

Good: the core stays pure and deterministic with no change at all; every response is
reproducible under a fixed clock, which is what makes the golden HTTP fixture meaningful; the
error surface is small, stable and auditable; and the privacy properties are enforced by tests
using sentinel values rather than by review.

Cost: the error table has to be maintained deliberately, and a new domain exception surfaces
as a 500 until somebody adds it. That is the intended failure direction. The clock-skew
rejection is strict. Unexpected failures are logged by exception class name only, so
diagnosing one means reproducing it rather than reading a message out of a log. And two
guarantees are weaker than the rest: disabling uvicorn's access log is deployment
configuration, and the backstop-handler re-raise path (a bug in our own middleware) would let
the server log a traceback — both recorded in `docs/privacy.md`.

Related: [ADR-0005](ADR-0005-forecast-origin-and-interval-space.md),
[ADR-0007](ADR-0007-demo-scenarios.md)

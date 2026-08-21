# ADR-0010 — CSV weight-history import: parsing boundary, timezone policy, and what stays unchanged

**Status:** accepted, Milestone 5
**Implements:** master plan §39; extends [ADR-0001](ADR-0001-state-and-units.md),
[ADR-0004](ADR-0004-multiple-observations-per-day.md), and the HTTP boundary established in
[ADR-0006](ADR-0006-http-boundary.md) and [ADR-0009](ADR-0009-real-data-browser-boundary.md)

## Context

Manual entry (Milestone 4) works, but typing years of history one row at a time is not how anyone
will actually use this product. Milestone 5 lets a user import a CSV of past weigh-ins instead.
`architecture.md`'s "where later work attaches" table already named the shape this would take —
"a parser in `app/ingestion/` producing `ObservationIn`, reusing `normalise_observations`" — so the
central question was not whether to reuse that seam, but how to fill it in without weakening any
guarantee Milestones 1–4 already made. Six decisions follow, several of them corrections made
during review rather than the first draft.

---

## 1. The backend parses the CSV; the browser never converts it

### Decision

A new module, `app/ingestion/csv.py`, parses CSV text into
`app.schemas.analysis.ObservationIn` objects — the exact class manual entry already produces.
The browser only uploads a file and renders whatever the backend reports.

### Why not parse in the browser

CSV validation is not a new problem: it is the *same* validation `ObservationIn` already performs
(positive finite weight, aware timestamp, a bound on how far in the future a timestamp may be).
Parsing in the backend means constructing that same class per row and letting Pydantic do the
checking, so CSV rows and manually typed rows are validated by one implementation, not two that
could drift. Browser-side parsing would mean re-implementing unit conversion, timestamp bounds and
error sanitisation in TypeScript — a second implementation of rules that are already tested here,
and the harder one to keep honest, since a JS reimplementation has no access to the sanitisation
infrastructure `app/api/errors.py` already provides. This also keeps a future Apple Health parser
symmetric: a multi-megabyte XML export is a poor fit for browser-side parsing, and a sibling
`app/ingestion/apple_health.py` can reuse the exact same size/row protections and
`normalise_observations` call this milestone builds. None of this was chosen for fewer lines of
code — the backend gained more code than a browser-side parser would have needed — it was chosen
because CSV validation *is* the existing validation, not a parallel one.

---

## 2. Ingestion is a separate endpoint, not folded into analysis

### Decision

`POST /api/ingest/csv` parses and normalises only, returning a report (`CsvIngestResponse`) with
an `accepted` list and a `rejected` list. The browser then calls the existing, **completely
unmodified** `POST /api/analyse` with `accepted`, exactly the call `MeasurementForm` already makes.

### Why two calls, not one

This gives the user a review checkpoint (counts and rejected-row reasons) before committing to
analysis, and it means `AnalysisResponse` and every existing test for it are untouched — CSV import
is provably an adapter in front of the existing analysis system, not a second analysis path.

### `accepted` is `ObservationIn`, not `ObservationOut` — a correction made during review

The first draft of this milestone planned to type `accepted` as `ObservationOut` (the response-side
class `AnalysisResponse.observations` already uses), reasoning that it was "the normalised
observation type, already existing." That was wrong: `ObservationOut` is `{timestamp, weight_kg}`,
with no `weight` or `unit` field, and `ObservationIn` has `extra="forbid"` — posting an
`ObservationOut`-shaped object as an item of `AnalysisRequest.observations` would fail validation
outright. The fix needed no new schema at all: the service layer builds each accepted entry as
`ObservationIn(timestamp=obs.timestamp, weight=obs.weight_kg, unit="kg")`, reusing the existing,
unmodified request-side class. A dedicated test posts an ingest response's `accepted` list straight
into a fresh `/api/analyse` request and asserts it validates, so this contract is checked, not just
argued for in this document. `app/schemas/analysis.py` is not modified.

---

## 3. The upload is a raw request body, not `multipart/form-data`

### Decision

`POST /api/ingest/csv` takes the CSV as the raw request body (`Content-Type: text/csv`), read via
`request.stream()` into a capped in-memory buffer. `assumed_timezone` and `default_unit` travel as
ordinary, both-required query parameters.

### Why, verified rather than assumed

The first draft planned a `multipart/form-data` upload using FastAPI's `File(...)`. Reading the
actually-installed `starlette.formparsers` (this project pins `starlette==1.6.0`) showed that
`MultiPartParser.spool_max_size = 1 MiB`: every uploaded file part is written into a
`tempfile.SpooledTemporaryFile`, which spills to a **real on-disk temporary file** the instant its
content exceeds that threshold. A "never written to disk" privacy claim would have been false for
any CSV over roughly a megabyte. `python-multipart` was also not yet a dependency. The raw-body
path avoids both problems: it never invokes Starlette's multipart parser at all, so it never
constructs a `SpooledTemporaryFile`, and it needs no new HTTP dependency. It is also what makes a
*genuine* byte cap possible — the route aborts the instant the buffer exceeds `MAX_CSV_BYTES`
(2 MiB), without waiting for the rest of the body to arrive, which a multipart parser's own
size limit could not do without first being reconfigured past its own 1 MiB default.

---

## 4. Naive timestamps: an IANA timezone, resolved per date, not a captured offset

### Decision

An explicit offset or `Z` is used as-is. A naive datetime or a bare date is localised against a
caller-supplied **IANA zone name** (e.g. `Europe/London`), using that specific date's DST rule —
not a single UTC offset captured at upload time. A naive local time that is **ambiguous** (occurs
twice, an autumn "fall back") or **nonexistent** (never occurs, a spring "forward" gap) is
**rejected**, not guessed. A bare date is assigned **12:00 local time** in the assumed zone, a
deterministic labelling convention — chosen because noon falls away from the early-morning hours
where DST transitions typically occur, not because it is a claim about when the weigh-in actually
happened.

### Classification algorithm, corrected during review

Comparing only the UTC offset at `fold=0` versus `fold=1` is not sufficient to tell a nonexistent
time from an ambiguous one — a nonexistent time can also show two different offsets between folds.
The actual check validates each fold candidate by converting it to UTC and back to the same zone:
a candidate that does not round-trip to the original wall-clock time never really occurred under
that fold. Neither candidate round-tripping means the time never occurred (nonexistent); both
round-tripping to two *different* UTC instants means it occurred twice (ambiguous); otherwise it is
an ordinary, unambiguous time. Direct tests against `Europe/London`'s real spring-forward and
fall-back transitions cover both branches.

### Why this needed no change to `ObservationIn` or the core

The parser always resolves a fully timezone-aware `datetime` — or rejects the row — *before*
constructing `ObservationIn`. By the time any existing code sees a CSV-derived timestamp, it looks
exactly like any other already-aware timestamp. `zoneinfo` (stdlib) does the resolution; `tzdata`
is added as a small, pure-data dependency so this is correct on Windows and minimal Linux images,
which do not reliably ship an IANA database of their own.

---

## 5. Exact duplicates are retained — and that is a real filter update, not a no-op

### Decision

Rows that resolve to the same timestamp and the same canonical (kg) weight are retained, not
collapsed, matching ADR-0004's existing keep-everything policy. They are separately counted
(`duplicate_count`) and surfaced to the user, e.g. *"2 exact duplicate rows retained. Repeated
rows are treated as repeated measurements."*

### A characterisation corrected during review

The first draft described feeding an identical reading twice at `dt = 0` as "mathematically
inert." That is wrong and has been removed from every place it appeared. `dt = 0` means there is no
*elapsed-time* evidence for velocity, but the Kalman **measurement update still runs**: a second
identical reading is genuine new evidence, tightens the posterior covariance, and can move the
posterior mean depending on the current state. It is a real, consequential update — ADR-0004
already establishes this exactly ("two readings at the same instant give `dt = 0`, which the model
handles exactly," not "which the model ignores"). This milestone's own test,
`test_duplicate_rows_are_retained_and_counted`, only proves the *count* is right; the underlying
mathematics was already tested and settled in Milestone 1.

### Where the count is computed

Counting happens in `app/services/ingestion.py`, *after* calling the existing
`normalise_observations` on the accepted rows — never in `csv.py` itself, which would otherwise
need to re-implement lb→kg conversion just to compare weights. `duplicate_count` is the number of
duplicate *occurrences beyond the first* in each group: three identical readings contribute 2, not
3 or 1.

---

## 6. Header and unit ambiguity fail closed, never resolved by precedence

### Decision

A header row with more than one recognised timestamp column, more than one recognised weight
column, or a duplicated `unit` column is a **whole-file** rejection — there is no reasonable way to
guess which column was meant. Per row, a weight column whose header already implies a unit (e.g.
`weight_kg`) combined with a `unit` cell naming the *opposite* unit is rejected as
`conflicting_unit`, not silently resolved by picking one signal over the other.

### Why not a precedence rule

An earlier version of this design proposed "per-row unit column overrides the header-implied unit,"
which would have silently accepted a self-contradictory file (`weight_kg` column, `unit: lb` cell)
by picking a winner. That is exactly the kind of guess master plan §40's "do not silently discard
or reinterpret data" principle rules out. Failing the row closed, with a specific reason code, costs
nothing a real export would ever trigger — a well-formed file simply never contains the
contradiction — while a genuinely malformed one is reported precisely instead of half-corrected.

---

## 7. Three error tiers, and no CSV row counts in any log

### Decision

Failures split into three tiers: request/file-level (oversized body, wrong `Content-Type`,
undecodable text, invalid timezone — the whole request is rejected before any row is read),
CSV-structural (missing/ambiguous columns, malformed CSV syntax — the whole file is rejected,
since rows cannot be reliably interpreted at all), and row-semantic (a single row's data is bad —
reported in the 200 response, every other row still analysed). The `rejected` list is capped at
500 entries with an exact `rejected_count` and an `issues_truncated` flag for the rest. **No
accepted/rejected/duplicate/blank-row count from this endpoint is written to any log** — unlike
`/api/analyse`, this route never calls `record_observation_count`.

### Why no logging, when the equivalent count is logged for `/api/analyse`

How many measurements someone is importing is itself health-adjacent metadata, and unlike
`/api/analyse` (where the count is genuinely useful operational signal about the shape of a
request the server just spent CPU on), the CSV parse report already reaches the caller directly in
the response body — there is no operational need served by writing it to a log as well. Where a
choice was not clearly required by an existing rule, this milestone chose the more private option.

---

## Consequences

Good: CSV validation is the same code manual entry already uses, not a parallel implementation;
`/api/analyse`, `ObservationIn`, `ObservationOut` and `normalise_observations` are all provably
unchanged, with the ingest→analyse contract checked by a dedicated test rather than assumed; the
"never written to disk" claim is one this design can actually make, having been checked against
the installed framework rather than assumed of it; ambiguous data is always reported, never
guessed, in units, in headers, and in timezones alike.

Cost: `tzdata` is a new backend dependency, needed for correct IANA rules on platforms without a
system database of their own. The row/file-size caps (2 MiB, 10,000 rows, 500 reported issues) are
this milestone's judgement calls, not derived from a hard constraint, and may need revisiting
against real import files. A single CSV field is still bounded by Python's own
`csv.field_size_limit` (128 KiB by default) independently of `MAX_CSV_BYTES` — not expected to
matter for weight-history data, but a file with one pathologically large cell would be rejected as
malformed rather than accepted.

Related: [ADR-0001](ADR-0001-state-and-units.md),
[ADR-0004](ADR-0004-multiple-observations-per-day.md), [ADR-0006](ADR-0006-http-boundary.md),
[ADR-0009](ADR-0009-real-data-browser-boundary.md)

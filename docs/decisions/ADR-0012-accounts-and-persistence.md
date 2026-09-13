# ADR-0012 — Accounts and persistence: the signed-in beta app

**Status:** accepted, Milestone 8 (implemented; not yet deployed)
**Extends:** [ADR-0006](ADR-0006-http-boundary.md), [ADR-0008](ADR-0008-frontend-contract-and-cors.md),
[ADR-0009](ADR-0009-real-data-browser-boundary.md), [ADR-0010](ADR-0010-csv-ingestion.md)
**Does not change:** ADR-0001 to ADR-0005 (the model), ADR-0007 (demo scenarios), ADR-0011
(evaluation)

This ADR records the architecture as it was built, not the proposal that preceded it. Where the
implementation settled a question the proposal left open, the implemented answer is recorded. It
does not amend earlier ADRs: those described a stateless system, and remain an accurate record of
the decisions made at the time.

## Context

Until Milestone 8 HealthTrend was stateless by construction. A person could analyse their own
readings, but had to bring the whole history every visit. The product's value — an estimate of the
underlying trend that gets better as readings accumulate — needs a history the person does not have
to carry. Milestone 8 adds identity and storage so a person can return, log a reading, and see the
same estimate the public routes compute.

Three constraints shaped every decision:

1. **The estimator must not change.** No new analysis path, no new parameters, and nothing a
   stored setting could feed into the model (CLAUDE.md, invariants 2–4).
2. **The public product must keep working and stay stateless.** V1 and V2 are live and
   recruiter-facing.
3. **Health data rules carry over.** Nothing in a log, nothing in browser storage, only synthetic
   data committed ([privacy.md](../privacy.md)).

---

## Decisions

### 1. Hosting: Vercel frontend, Render FastAPI, Neon Postgres

The frontend stays on Vercel and the API on Render, where both already run. The database is managed
Postgres on Neon. The application code names none of these: it reads a SQLAlchemy URL and SMTP
settings from the environment, so any Postgres and any SMTP provider work. Resend's SMTP interface
is the preferred mail provider, as configuration only.

### 2. SQLAlchemy 2 (sync), Alembic, psycopg 3

`app/persistence/` uses SQLAlchemy 2.0 in synchronous mode with psycopg 3. The request volume of a
private beta does not justify an async driver and the concurrency model that comes with it, and the
existing service layer is synchronous. The schema is created and changed only by Alembic
migrations (`backend/alembic/`), never at application startup; `alembic check` detects a model
change with no migration. The test suite runs on in-memory SQLite, and a CI job re-runs the
persistence tests and the migration cycle against a real Postgres 16, because datetimes, column
lengths and constraint errors are where the two differ.

Six tables: `users`, `login_codes`, `sessions`, `measurements`, `preferences`, `goals`. Every
account-owned table cascades on delete from `users`. A measurement is stored exactly as entered —
its own weight and unit — and converted to kilograms only when analysed.

### 3. Passwordless sign-in with an emailed six-digit code

No passwords to store, reset or leak. `POST /api/auth/code/request` emails a code;
`POST /api/auth/code/verify` exchanges it for a session. The first successful verification for an
address creates the account. The request endpoint answers identically whether or not an account
exists for the address, so it cannot be used to learn whether one does. An optional allow-list
(`HEALTHTREND_BETA_ALLOWED_EMAILS`) closes sign-up for the beta, and is re-checked on every
authenticated request, so removing an address ends its existing sessions too.

Allow-list membership is not equally hidden. A single request answers the same `202` for an
allow-listed and an off-list address, but an off-list address returns before the
three-per-15-minutes rate-limit check, while an allow-listed one is counted against it. Repeated
requests therefore separate the two: the allow-listed address eventually receives the `429`
rate-limit response and the off-list address never does. This limited membership side channel is
an accepted private-beta limitation (see [Beta limitations](#beta-limitations-accepted-not-fixed)).

### 4. Codes are HMAC-authenticated, never stored in the clear or as a bare hash

A six-digit code has only a million possible values, so a plain hash is reversible by enumeration by
anyone holding a copy of the table. Codes are stored as
`HMAC-SHA256(HEALTHTREND_AUTH_SECRET, normalised_email ":" code)` and compared in constant time. The
secret is a required server setting of at least 32 characters. Codes expire after 10 minutes, allow
five attempts (counted and committed before comparison, so a failure cannot roll the count back),
and are limited to three per address per 15 minutes. A code whose email could not be sent is deleted.

### 5. Sessions are opaque random tokens, stored hashed

A session token is 256 random bits. The server stores only its SHA-256 — no key is needed for a
high-entropy token — so a database copy yields no usable session. Sessions last 90 days from last
use, sliding forward at most once a day to avoid a write on every request. Signing out deletes the
row.

### 6. The cookie model: HttpOnly, Secure, SameSite=Lax, host-only

The token travels only in the `ht_session` cookie: `HttpOnly`, `Secure` (required in production;
`HEALTHTREND_COOKIE_SECURE` defaults to true), `SameSite=Lax`, `Path=/`, no `Domain`. Every account
and sign-in response is `Cache-Control: no-store`.

**No token ever reaches browser storage.** The frontend has no access to the token at all, and the
existing static guard forbidding `localStorage`, `sessionStorage`, IndexedDB, `document.cookie`, the
Cache API and `navigator.storage` covers the new code unchanged. A bearer token in browser storage
was rejected: it is readable by any script that runs on the page, and would break that guard.

### 7. Same-site deployment is a requirement, not a preference

The browser calls the API directly with `credentials: "include"` (the model ADR-0009 chose for
own-data submission). CORS is credentialed, but only for origins named in
`HEALTHTREND_ALLOWED_ORIGINS`; a `*` entry stops the application from starting.

A `SameSite=Lax` cookie is not sent on a cross-site `fetch`, and Safari refuses third-party cookies
outright. The frontend and API must therefore be **same-site** — the same registrable domain — for
signed-in requests to carry the cookie. Two provider default domains (`*.vercel.app`,
`*.onrender.com`) are different sites; both are on the Public Suffix List, so even two subdomains of
one of them are different sites. The preferred production shape is `app.<domain>` for the frontend
and `api.<domain>` for the API. A same-origin proxy (a Vercel rewrite of `/api/*` to the API) would
also satisfy the requirement without code changes, and is recorded as a fallback only
([deployment.md](../deployment.md)).

`SameSite=None` was rejected: it would make cross-site operation depend on third-party cookie
support that Safari does not provide and other browsers are withdrawing, and would widen CSRF
exposure for no gain once the deployment is same-site.

### 8. `/app` is a separate surface; the public routes stay stateless

The signed-in product lives under `/app` (sign-in, Trend, Log, History, Import, Settings). It reuses
V2's design tokens and components rather than forking them, and is not linked from the public V2
navigation. `POST /api/analyse`, `POST /api/ingest/csv` and the demo routes remain stateless and read
no session. Authentication is enforced on the client by one account check (`GET /api/me`), with no
Next.js middleware and no server-side cookie inspection: the API is the only authority on a session.

### 9. The account analysis reuses the existing analysis path

`GET /api/me/analysis` loads the account's measurements, builds the same `AnalysisRequest` a
submitted series produces, and calls the unmodified `app.services.analysis.analyse_submitted`. Only
`meta.source` is relabelled `"account"`. A test posts one series to `POST /api/analyse`, stores and
analyses the same series, and asserts the responses are identical apart from that field. The frontend
renders the result through the unchanged `V2Workspace`. `app/core/**`, `ModelParams` and the golden
fixtures are untouched.

CSV import into an account likewise reuses the existing stateless parser: the browser parses with
`POST /api/ingest/csv`, the person reviews the report, and the accepted rows are stored with
`POST /api/me/measurements/batch`. There is one CSV parser.

### 10. Goals are structurally excluded from inference

One optional goal per account (target weight and/or target weekly rate) is stored for display. The
account analysis takes stored measurements and the clock as its only inputs; there is no parameter a
goal could reach. Tests assert that setting, changing, deleting and sweeping goal values across their
bounds leave the analysis byte-for-byte identical. The display unit preference is presentation only:
stored readings keep their units and the analysis is unaffected.

### 11. Milestone 7A results stay out of the product

No on-plan probability, departure detection, plateau, change-point or outlier output exists in the
account API or `/app`. None of M7A's candidates is product-eligible
([m7a_report.md](../evaluation/m7a_report.md)), and the account analysis response carries exactly
the fields the stateless response always has; a test pins that.

### 12. No service worker and no offline queue in the beta

`/app` ships a web app manifest and home-screen icons, scoped to `/app` so public pages link no
manifest. There is no service worker, no offline logging and no client-side queue: an offline queue
would need browser storage of health data, which the privacy rules forbid, and conflict resolution
the beta does not need.

### 13. Export and deletion

Two exports, deliberately distinct: a versioned JSON file of the account data HealthTrend stores, and
a measurements-only CSV in exactly the shape the CSV importer accepts (a test round-trips it).
`DELETE /api/me`, after the person retypes their email address, hard-deletes the account row —
cascading to sessions, measurements, preference and goal — and separately purges sign-in codes for
that address, which have no foreign key to the account. There is no soft delete, undo or retention
window in the application. Provider backups are outside the application's control and are described
as such, not promised away ([privacy.md](../privacy.md)).

### 14. Startup fails closed

The server reads its settings at startup and refuses to start without a database URL, an auth secret
of sufficient length and a complete mailer configuration; the console mailer is refused whenever the
cookie is `Secure`. This is kept even though it means the M8 backend cannot replace the pre-M8 one
without its configuration in place first — see Consequences.

---

## Beta limitations (accepted, not fixed)

- **No per-IP rate limiting.** Only the per-address code limit exists.
- **`invalid_code` and `code_expired` are distinguishable**, revealing that a code once existed.
- **Allow-list membership can be inferred by repeated code requests**, because only an
  allow-listed address ever reaches the per-address rate limit (§3). Account existence is not
  revealed.
- **No scheduled sweep of expired sessions or old sign-in codes**; they are removed when next
  presented, when the address requests again, or with the account.
- **No email change, second factor or active-sessions view.**
- **Two codes issued in the same instant have no defined order**; reachable only under a frozen
  test clock.
- **No measurement is repaired or de-duplicated at analysis time**; only batch import skips rows
  already stored.
- **Render's free tier sleeps**, so a first request after idle can take tens of seconds.

## Deferred (not built, not implied by this ADR)

Native apps; a service worker or offline logging; Apple Health, Health Connect or smart-scale
import; social or multi-user features; coaching; payments; any M7A output; plateau, change-point or
outlier detection; a goal ETA; medical recommendations; per-user parameter fitting.

---

## Consequences

- **The backend now needs infrastructure to start.** The same process serves the stateless public
  routes, so deploying M8 code to the existing API service without a migrated database, an auth
  secret and SMTP configured stops the public V2 API too. Configuration must be in place, and
  migrations applied, before the M8 code is deployed ([deployment.md](../deployment.md)). Weakening
  fail-closed startup to avoid this was rejected.
- **The deployment topology is constrained.** A custom domain (or the proxy fallback) is required
  before the beta works in a browser; provider default URLs alone are not deployment-ready.
- **Health data is now held server-side**, for signed-in accounts only. The privacy document
  distinguishes the two surfaces and states what deletion does and does not reach.
- **The model stays reusable and provably unchanged.** Because the account analysis is the submitted
  analysis, every estimator guarantee and golden fixture carries over, and any later model change
  affects both surfaces identically.
- **Two things became load-bearing configuration**: `HEALTHTREND_ALLOWED_ORIGINS` must list the
  `/app` origin (and the public frontend origin, whose own-data page calls the API from the browser),
  and `NEXT_PUBLIC_HEALTHTREND_API_URL` is baked into the frontend build.

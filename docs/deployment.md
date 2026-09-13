# Deployment

How the Milestone 8 beta is meant to be deployed, and what must be true before it is. **Nothing here
has been done yet.** No Neon database, SMTP account, custom domain or new Render or Vercel
configuration exists for the beta. The architecture behind these steps is
[ADR-0012](decisions/ADR-0012-accounts-and-persistence.md).

---

## ⚠ Read first: the M8 backend cannot simply replace the live one

The public V2 site is live, and its API runs on Render. The M8 backend serves those same public
routes **and** the account routes from one process, and it **refuses to start** unless all of these
are in place:

- `HEALTHTREND_DATABASE_URL`, pointing at a Postgres database;
- `HEALTHTREND_AUTH_SECRET`, at least 32 characters;
- a complete production mailer configuration (`HEALTHTREND_MAILER=smtp` with host and sender);

and it needs that database **already migrated** before the account routes work.

Deploying the M8 code to the existing Render service without them stops the server at startup, which
takes the public V2 API offline — including the synthetic demo pages, whose data comes from that API.
This is deliberate fail-closed behaviour and must not be weakened to make a deploy "succeed". The
rollout order below exists to avoid it.

---

## Target topology

| Piece | Where | Notes |
| --- | --- | --- |
| Frontend (public V2, V1, and `/app`) | Vercel | one Next.js project, as today |
| API (public routes and account routes) | Render | FastAPI, `backend/` |
| Database | Neon Postgres | used only by the account routes |
| Sign-in email | any SMTP provider; Resend's SMTP interface preferred | configuration only; no provider SDK in the code |

**Preferred production shape:** `app.<domain>` → Vercel, `api.<domain>` → Render, both under one
registrable domain that Alfred chooses.

### Same-site is a deployment acceptance criterion

`/app` signs in with an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie set by the API, and the
browser calls the API directly with `credentials: "include"`. A `SameSite=Lax` cookie is not sent on
a cross-site request, and Safari (including every browser on iOS) blocks third-party cookies outright.
So **the frontend and API must be same-site**: the same registrable domain.

- `app.example.com` and `api.example.com` — same site. Works.
- `something.vercel.app` and `something.onrender.com` — different sites. **Sign-in will appear to
  succeed and then every account request will be unauthenticated.**
- Two subdomains of `vercel.app` or of `onrender.com` — also different sites (both are public-suffix
  domains).

The beta is not deployment-ready because Vercel and Render each have a working default URL. It is
ready only when the [acceptance test](#same-site-acceptance-test-after-dns) passes on the real
domains. Moving the token into browser storage or a bearer header to "fix" a cross-site deployment is
ruled out (ADR-0012 §6–7).

---

## Environment

### Backend (Render)

Names and placeholders are in [`backend/.env.example`](../backend/.env.example). Production values:

| Variable | Production value |
| --- | --- |
| `HEALTHTREND_DATABASE_URL` | Neon connection string with the psycopg 3 driver: `postgresql+psycopg://…?sslmode=require` (a bare `postgresql://` URL names a driver that is not installed, and startup fails). Use Neon's direct, unpooled endpoint unless the pooled one has been tested with psycopg 3. |
| `HEALTHTREND_AUTH_SECRET` | a fresh random value of at least 32 characters, stored only in Render |
| `HEALTHTREND_COOKIE_SECURE` | `true` (the default; leave unset or set explicitly) |
| `HEALTHTREND_MAILER` | `smtp` — the `console` mailer is refused whenever the cookie is Secure |
| `HEALTHTREND_SMTP_HOST`, `HEALTHTREND_SMTP_PORT`, `HEALTHTREND_SMTP_USER`, `HEALTHTREND_SMTP_PASSWORD`, `HEALTHTREND_SMTP_FROM` | from the SMTP provider; the sender domain needs the provider's SPF/DKIM records for codes to be delivered reliably |
| `HEALTHTREND_ALLOWED_ORIGINS` | `https://app.<domain>`, plus the public frontend origin for as long as it is served from another origin — its own-data page calls `POST /api/analyse` from the browser |
| `HEALTHTREND_BETA_ALLOWED_EMAILS` | the beta testers' addresses; leaving it unset opens sign-up to anyone |

### Frontend (Vercel)

| Variable | Production value |
| --- | --- |
| `HEALTHTREND_API_URL` | the API origin, read server-side by the demo pages |
| `NEXT_PUBLIC_HEALTHTREND_API_URL` | `https://api.<domain>`. **Build-time**: it is compiled into the bundle, so changing it needs a rebuild. It is used by the public own-data pages and by every `/app` request. |

---

## Commands

**Migrations**, from `backend/`, needing only the database URL (the migration environment reads no
other setting):

```bash
HEALTHTREND_DATABASE_URL='postgresql+psycopg://…' uv run alembic upgrade head
HEALTHTREND_DATABASE_URL='postgresql+psycopg://…' uv run alembic check   # models match migrations
```

Run them from a trusted machine, or as a pre-deploy step where the Render plan offers one — always
**before** the M8 code serves traffic. The application never creates or migrates the schema itself.
**Never run `alembic downgrade` against a database holding real accounts**: the only migration is the
initial one, so downgrading drops every table.

**Backend** on Render, root directory `backend/`, Python version from `backend/.python-version`.
Confirm against the live service's current settings before changing them:

```bash
# build
uv sync --locked --no-dev
# start
uv run --no-dev uvicorn app.main:app --host 0.0.0.0 --port $PORT --no-access-log
```

`--no-access-log` is part of the privacy posture ([privacy.md](privacy.md)). Set the service's health
check path to `/health`, so a deploy that fails to start is not promoted over a working one where the
plan supports health-checked deploys.

**Frontend** on Vercel, root directory `frontend/`: `npm ci`, then `npm run build`. The generated API
types are committed, so the build needs no running backend.

**Build order:** database migrated → backend deployed and healthy → frontend built with the final
`NEXT_PUBLIC_HEALTHTREND_API_URL`.

---

## Rollout order that keeps the public product up

1. **Decide** the domain, the Neon region, the Render tier, the SMTP provider and the beta
   allow-list.
2. **Provision Neon** and run the migrations against it. Confirm `alembic check` reports no drift.
3. **Stand the M8 API up beside the live one**, on a new Render service reached at `api.<domain>`,
   with every backend variable above set before its first deploy. The existing service keeps serving
   the public site untouched. (Alternatively, add all the new variables to the existing service
   while it still runs the old code, which does not read them, and only then deploy the M8 code.
   The separate service is safer because a mistake cannot reach the live API.)
4. **Verify the new API on its own**: `/health` answers; `GET /api/demo/gradual-loss` answers; a
   sign-in code is delivered to an allow-listed address.
5. **Deploy the frontend** with `NEXT_PUBLIC_HEALTHTREND_API_URL` and `HEALTHTREND_API_URL` pointing
   at the new API, served at `app.<domain>`. From this point the public own-data pages also call the
   new API, which is why its allow-list must include the public origin.
6. **Run the same-site acceptance test** below. Only then invite testers.
7. **Retire the old API service** once the public site has run on the new one without issue.

Vercel preview deployments live on `*.vercel.app`, so they cannot exercise signed-in `/app` flows
against `api.<domain>`; test `/app` on the production domains.

## Same-site acceptance test (after DNS)

On the real domains, on at least desktop Chrome, desktop Safari and **Safari on iOS**:

1. Open `https://app.<domain>/app` — it redirects to sign-in.
2. Request a code for an allow-listed address; the email arrives.
3. Verify the code — Trend opens.
4. **Reload the page — still signed in.** (This is the check that fails cross-site.)
5. Log a reading; Trend shows it. Edit and delete it from History.
6. Import `sample_data/example.csv`; the counts appear; importing it again adds nothing.
7. Change the display unit and set a goal; reload — both persist.
8. Download both exports.
9. Sign out — `/app` redirects to sign-in, and the browser's back button does not restore access.
10. Sign in again and delete the account; signing in afterwards starts an empty account.
11. In the browser's developer tools, confirm `ht_session` is `HttpOnly`, `Secure`, `SameSite=Lax`,
    scoped to `api.<domain>`, and that no application storage is used.
12. Confirm the public V2 site still works: a demo scenario, and `/v2/analyse` with typed readings.

## Fallback only: a same-origin rewrite

If a custom domain is not available, the requirement can also be met by serving the API through the
frontend's own origin: a Vercel rewrite of `/api/:path*` to the Render service, with
`NEXT_PUBLIC_HEALTHTREND_API_URL` set to the **full** frontend origin (not empty — the CSV import
builds an absolute URL from it). The cookie then belongs to the frontend host and every request is
same-origin. This needs no application code change but is **not implemented in this repository** and
is not the preferred shape: every request takes an extra hop, a sleeping Render instance can outlast
the proxy's timeout, and it has not been tested. Treat it as a fallback to test deliberately, not an
equal alternative.

## Rollback and recovery

- **Frontend:** redeploy the previous Vercel deployment. The public V2 routes do not depend on the
  database.
- **Backend:** redeploy the previous Render deploy. The pre-M8 code ignores the new variables and the
  database. If the M8 API was stood up as a separate service (step 3), rolling back is pointing the
  frontend's API variables at the old service and rebuilding.
- **Database:** take a Neon branch or restore point before any future migration. Migrations are
  forward-only in practice once real data exists (see above). Deleted accounts are not recoverable by
  the application; provider restore history is not a product feature and must not be used to
  resurrect a deleted account.
- **Secrets:** rotating `HEALTHTREND_AUTH_SECRET` invalidates outstanding sign-in codes only, not
  sessions. Ending all sessions means deleting the `sessions` rows.

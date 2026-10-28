# Production deployment and operations

## Current production topology

HealthTrend is **deployed**. The public demo and the signed-in account application run on the same frontend, backed by one API service and a persistent PostgreSQL database.

| Component | Production |
| --- | --- |
| Frontend | Vercel — `https://healthtrend.alfredhong.com` |
| Signed-in app | `https://healthtrend.alfredhong.com/app` |
| Apple Health onboarding | `https://healthtrend.alfredhong.com/app/connect/apple-health` |
| Public demo | `https://healthtrend.alfredhong.com/v2/gradual-loss` |
| API | Render — `https://healthtrend-api.alfredhong.com` |
| API health check | `https://healthtrend-api.alfredhong.com/health` |
| Persistent database | Neon PostgreSQL (schema migration `0002_sync_connections` or later) |
| Sign-in email | SMTP provider (Resend configuration) |
| DNS | Cloudflare |

The custom API domain is attached to the current Render API service, not to the previous `healthtrend-m8` service. The frontend and API both use `alfredhong.com` so browser session cookies can work with the chosen SameSite policy.

## Environment (secrets must stay out of Git)

**Render/backend**, root directory `backend/`:

- `HEALTHTREND_DATABASE_URL`: Neon direct connection using `postgresql+psycopg://` and TLS (`sslmode=require`).
- `HEALTHTREND_AUTH_SECRET`: sufficiently long random secret (at least 32 characters).
- `HEALTHTREND_COOKIE_SECURE=true`.
- `HEALTHTREND_MAILER=smtp` plus the SMTP host, port, username, password and sender values. On the deployed Render Free configuration the Resend SMTP port is `2587`.
- `HEALTHTREND_ALLOWED_ORIGINS`: comma-separated exact origins including `https://healthtrend.alfredhong.com` (and the legacy Vercel hostname if still used). This is not JSON. Check the `access-control-allow-origin` response header for browser calls.
- `HEALTHTREND_BETA_ALLOWED_EMAILS`: **unset or empty only if public registration has been intentionally enabled**. Confirm by testing a fresh email; do not infer the value from source code.

**Vercel/frontend**, root directory `frontend/`:

- `HEALTHTREND_API_URL=https://healthtrend-api.alfredhong.com`
- `NEXT_PUBLIC_HEALTHTREND_API_URL=https://healthtrend-api.alfredhong.com`

The `NEXT_PUBLIC_` variable is compiled into the web bundle: redeploy after changing it. Do not store production secrets in frontend environment variables exposed to the browser.

## Backend build and start

The live Render service has been run with:

```bash
# Build (Render, from backend/)
pip install uv && uv sync --locked

# Start (from backend/)
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $PORT --no-access-log
```

Use the actual deployed service's current configuration as the source of truth before making future changes. The required `/health` endpoint responds with a JSON status. A healthy public API does not, by itself, prove that authenticated account routes, email delivery or Apple Health sync work.

## Database migrations

The production database has been upgraded through `0002_sync_connections` for dedicated Apple Health credentials and the `apple_health` measurement source. Migration `0001_initial` was the original account schema. From `backend/`, with a trusted **production** database URL supplied privately in the environment:

```bash
uv run python -m alembic current
uv run python -m alembic upgrade head
uv run python -m alembic check
```

Run migrations before deploying an API version requiring them. Never paste the database URL into issues, chats, screenshots, code or shell transcripts. Never run `alembic downgrade` against a database containing real accounts: destructive downgrades can remove user data or connection credentials. Use a Neon branch or backup/restore point before future schema changes.

## Deployment sequence

1. Review the Git diff and verify the code/test suite locally; the developer controls Git commits and pushes.
2. Confirm schema migrations against the intended database and all required Render environment settings.
3. Deploy the backend and confirm its health endpoint and authenticated-route smoke tests.
4. Deploy the frontend on Vercel with the right API origin baked into the build.
5. Test production using the custom domain, including in iPhone Safari.

Browser testing is critical: frontend server rendering, authenticated browser requests and a Shortcut's direct API request have different failure modes.

## Production smoke test

- `/health` returns success on the custom API domain.
- For a browser-origin test, the API returns `access-control-allow-origin: https://healthtrend.alfredhong.com` and `access-control-allow-credentials: true` where applicable.
- Request and verify a sign-in code, then reload `/app` and remain signed in.
- Log/edit/delete a measurement, verify the trend, and check CSV import and export.
- Check Settings → Connected Sources and create a dedicated sync connection.
- Confirm the 3-year history Shortcut and recurring 14-day Shortcut each accept a user-inserted token and sync Weight readings. A repeated sync must not duplicate exact readings.
- Revoke a test connection and verify the old bearer credential stops working. Replace it with a fresh connection for actual ongoing sync.
- Test an unaffiliated email address if opening registration to the public.
- Verify a publicly reachable privacy notice and the signed-in account-deletion flow before claiming unrestricted public launch.

## Recovery and operational cautions

- **Frontend rollback:** redeploy a previously working Vercel build if a frontend-only release fails.
- **Backend rollback:** redeploy a previously working Render revision only if it is compatible with the current database schema.
- **Database:** prefer forward-compatible changes, Neon branching and controlled backups; do not rely on a destructive downgrade against live data.
- **Secrets:** rotate a compromised Apple Health sync token by revoking its connection; rotate service secrets through provider settings without committing them to Git.
- **Old Render service:** do not reattach the production custom domain to a stale service during troubleshooting.

See [architecture](architecture.md), [privacy](privacy.md) and [account/persistence decisions](decisions/ADR-0012-accounts-and-persistence.md).

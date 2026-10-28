# Privacy and data handling

HealthTrend processes body-weight measurements and account information. This document describes the application's engineering controls and data flows. It is not a substitute for a public-facing legal privacy notice.

## Two ways to use HealthTrend

| Mode | What happens to measurements |
| --- | --- |
| Public demo | Uses labelled, synthetic data. No personal health measurements are required. |
| Public "Analyse your data" page | Sends submitted measurements to the analysis API for a response, without adding them to a persistent account history. A page reload clears the temporary input. |
| Signed-in app (`/app`) | Stores the account's measurements and preferences in the production database so they are available across visits. |

The signed-in application has persistent accounts and a stored measurement history; the public analysis flow and signed-in product have deliberately different retention behaviour.

## What the signed-in app stores

- Account identity (email) and the information required for passwordless sign-in and sessions.
- Weight readings with timestamps, units and source labels (manual, CSV or Apple Health).
- Display preference and optional goal information. Goals are references in the UI; they do not affect estimation.
- Apple Health connection metadata, including a connection identifier, label, creation/last-use information and a **hash** of the sync token, not its plaintext value.

The backend uses PostgreSQL with account-scoped queries. Authentication uses a Secure, HttpOnly, SameSite=Lax session cookie. Sign-in codes and session credentials are stored using the project's hashing/HMAC design rather than as plaintext values. The one-time sync-token secret is displayed at creation, then retained only in hashed form server-side. Removing a connection revokes its credential; account deletion removes its associated stored measurements and connections.

Data export is available as measurement CSV and account JSON. Account deletion is irreversible through the application. Export first if you want to keep a copy.

## Apple Health integration

The iPhone Shortcuts integration reads **Weight only** from Apple Health. It does not read unrelated Health data, and it does not write data back to Apple Health. Users install the Shortcuts themselves and paste a dedicated connection token into the token Text action on the device.

The one-time history import searches up to three years; the recurring Shortcut searches the latest 14 days. Both send matching measurements to the user's HealthTrend account using the dedicated token. The API performs insert-only ingestion with exact duplicate detection. The token can be revoked under **Settings → Connected Sources**. Treat it like a password: never post, screenshot or commit a working token.

## Browser storage

The signed-in app uses a secure session cookie for authentication. The application does **not** store that session token in `localStorage` or `sessionStorage`.

The appearance feature has one deliberate exception to the general browser-storage restriction: `localStorage` key `healthtrend-theme` stores only `light` or `dark`, so the selected colour theme persists in that browser. It contains no weight measurements or authentication credentials and is not an account setting. This exception is specifically tested rather than allowing arbitrary local browser storage throughout the frontend.

## Logging and errors

- The numerical core is deterministic and does not access logging, the environment or the filesystem.
- Application request logs record bounded metadata (such as route templates, status and observation counts), not request bodies, weight values or raw caller-provided paths.
- Validation and server errors are mapped to fixed, non-sensitive public messages rather than exposing submitted values or exception text.
- Uvicorn access logging is disabled in the production start command as an additional privacy measure.
- Only explicitly labelled synthetic data may be committed to the repository. Raw exports, database URLs, API keys and `.env` files must not be committed.

The backend privacy tests exercise data-leakage failure paths, and the frontend has storage/privacy guard tests. These controls reduce exposure risk but do not amount to a guarantee against all security incidents.

## Hosting and external services

The public web frontend is deployed on Vercel, the API on Render, and the account database on Neon PostgreSQL. Passwordless sign-in codes are delivered by an SMTP provider. These services necessarily process the requests or data needed to operate their component. Do not imply that signed-in measurements never leave the user's device: they are uploaded to and stored by the HealthTrend service.

## Research and medical limits

HealthTrend estimates a statistical weight trend and possible future trajectories. Its reported calibration experiments use synthetic data; they are not clinical or real-person forecast validation. HealthTrend is not a medical device and does not diagnose, treat, prescribe or make claims about health outcomes.

For numerical details and measured failures, see [the evaluation report](evaluation/report.md) and [the model documentation](mathematics.md).

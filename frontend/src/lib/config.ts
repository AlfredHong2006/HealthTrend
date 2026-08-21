/**
 * The FastAPI base URL.
 *
 * Read server-side only. Every fetch to the backend happens from a Next.js server
 * component (see `src/lib/api/client.ts`), so this value is never bundled for the browser
 * and is deliberately not prefixed `NEXT_PUBLIC_`.
 */
export function apiBaseUrl(): string {
  const url = process.env.HEALTHTREND_API_URL ?? "http://localhost:8000";
  return url.replace(/\/+$/, "");
}

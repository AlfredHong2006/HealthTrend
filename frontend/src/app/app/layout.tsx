import type { Metadata, Viewport } from "next";
import "../v2/v2-tokens.css";
import { AccountProvider } from "@/components/app/AccountProvider/AccountProvider";
import { APP_THEME_COLOR, MANIFEST_PATH } from "@/lib/app/manifest";

/**
 * Overrides the root description for `/app` only. The root one tells a public visitor that
 * nothing is stored, which is true of the public routes and false here, where an account keeps
 * its measurements, preference and goal.
 *
 * The manifest and home-screen tags live here rather than in the root layout, so public V1 and V2
 * pages link no manifest and never offer to install the signed-in app.
 */
export const metadata: Metadata = {
  description:
    "Your HealthTrend beta account: stored weigh-ins, the estimated trend behind them, and your data to export or delete.",
  manifest: MANIFEST_PATH,
  appleWebApp: {
    capable: true,
    title: "HealthTrend",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: APP_THEME_COLOR,
};

/**
 * The Beta App's own shell. Reuses the `.htV2` token scope V2 already established -- the same
 * import `src/app/v2/layout.tsx` uses, not a copy of its rules -- rather than opening a third
 * design language for one more surface (docs/design/V2_DESIGN.md).
 *
 * Wraps every `/app` route, `/app/sign-in` included, in the one `AccountProvider` account
 * check: the sign-in page reads it to redirect an already-authenticated visitor away, and
 * `AppAuthGate` (inside the protected pages) reads the same result to redirect an
 * unauthenticated one to sign in. Neither issues its own `GET /api/me`.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="htV2">
      <AccountProvider>{children}</AccountProvider>
    </div>
  );
}

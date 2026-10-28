import type { Metadata } from "next";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "HealthTrend",
  description:
    "Estimates the underlying weight trajectory behind noisy scale readings and forecasts where it is heading, with explicit uncertainty. Try it with synthetic demo data, or enter your own -- nothing is stored either way.",
};

/**
 * No third-party font, script or stylesheet: nothing in this layout causes a browser
 * request to any origin other than this one and the configured backend
 * (docs/privacy.md). The system font stack in tokens.css needs no font file at all.
 *
 * The one inline script applies a stored light/dark choice before first paint, so the page never
 * flashes the wrong theme. It sets `data-theme` on `<html>` ahead of hydration, which is what
 * `suppressHydrationWarning` on that element is for: the attribute is expected to differ from the
 * server's markup, and React leaves it alone.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <a href="#main-content" className="skipLink">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

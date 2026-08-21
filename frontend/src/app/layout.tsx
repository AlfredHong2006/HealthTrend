import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HealthTrend",
  description:
    "Estimates the underlying weight trajectory behind noisy scale readings and forecasts where it is heading, with explicit uncertainty. Synthetic demo data only.",
};

/**
 * No third-party font, script or stylesheet: nothing in this layout causes a browser
 * request to any origin other than this one and the configured backend
 * (docs/privacy.md). The system font stack in tokens.css needs no font file at all.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skipLink">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

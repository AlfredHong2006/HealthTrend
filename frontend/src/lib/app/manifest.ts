/**
 * The web app manifest for the signed-in beta surface, `/app`.
 *
 * Served from `/app/manifest.webmanifest` and linked only from `/app` pages
 * (`src/app/app/layout.tsx`) rather than via Next's root `app/manifest.ts` convention, which would
 * link it from every page -- public V2 and V1 included -- and offer to install a signed-in app from
 * a stateless public route.
 *
 * Home-screen metadata only. There is no service worker and nothing works offline, so nothing
 * here claims either; opening the installed app still needs a network connection.
 */

import type { MetadataRoute } from "next";

/** The light 1B Editorial page colour (`--v2-paper-1`), which `/app` is drawn on. */
export const APP_THEME_COLOR = "#ffffff";

export const MANIFEST_PATH = "/app/manifest.webmanifest";

/** The manifest's PNG icons, rendered from the existing brand mark (`src/app/icon.svg`). */
export const MANIFEST_ICON_VARIANTS = ["192", "512", "maskable-512"] as const;
export type ManifestIconVariant = (typeof MANIFEST_ICON_VARIANTS)[number];

export function appManifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "HealthTrend",
    short_name: "HealthTrend",
    description:
      "Your HealthTrend beta account: stored weigh-ins and the estimated trend behind them.",
    start_url: "/app",
    scope: "/app",
    display: "standalone",
    background_color: APP_THEME_COLOR,
    theme_color: APP_THEME_COLOR,
    icons: [
      { src: "/app/manifest-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app/manifest-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/app/manifest-icon/maskable-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

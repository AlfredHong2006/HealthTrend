import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/app/manifest.webmanifest/route";
import { metadata, viewport } from "@/app/app/layout";
import { APP_THEME_COLOR, MANIFEST_ICON_VARIANTS, MANIFEST_PATH, appManifest } from "../manifest";

const SRC_ROOT = path.resolve(import.meta.dirname, "../../../");

describe("appManifest", () => {
  const manifest = appManifest();

  it("describes an installable app scoped to the signed-in surface", () => {
    expect(manifest).toMatchObject({
      id: "/app",
      name: "HealthTrend",
      short_name: "HealthTrend",
      start_url: "/app",
      scope: "/app",
      display: "standalone",
      background_color: APP_THEME_COLOR,
      theme_color: APP_THEME_COLOR,
    });
  });

  it("lists PNG icons at 192 and 512, plus a maskable 512, each served by a real route", () => {
    expect(manifest.icons).toEqual([
      { src: "/app/manifest-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app/manifest-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/app/manifest-icon/maskable-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ]);
    for (const icon of manifest.icons ?? []) {
      const variant = icon.src.split("/").at(-1);
      expect(MANIFEST_ICON_VARIANTS).toContain(variant);
    }
    expect(existsSync(path.join(SRC_ROOT, "app/app/manifest-icon/[variant]/route.tsx"))).toBe(true);
  });

  it("claims no offline capability, and no service worker exists to provide one", () => {
    expect(JSON.stringify(manifest)).not.toMatch(/offline/i);
    expect(existsSync(path.join(SRC_ROOT, "app/sw.ts"))).toBe(false);
    expect(existsSync(path.join(SRC_ROOT, "../public/sw.js"))).toBe(false);
  });
});

describe("GET /app/manifest.webmanifest", () => {
  it("serves the manifest as application/manifest+json", async () => {
    const response = GET();

    expect(response.headers.get("Content-Type")).toBe("application/manifest+json");
    expect(await response.json()).toEqual(appManifest());
  });
});

describe("/app layout metadata", () => {
  it("links the manifest and sets home-screen metadata for /app pages", () => {
    expect(metadata.manifest).toBe(MANIFEST_PATH);
    expect(metadata.appleWebApp).toMatchObject({ capable: true, title: "HealthTrend" });
    expect(viewport.themeColor).toBe(APP_THEME_COLOR);
  });

  it("does not repeat the public claim that nothing is stored", () => {
    expect(String(metadata.description)).not.toMatch(/nothing is stored/i);
  });

  it("is not a root manifest, so public V1 and V2 pages link none", () => {
    for (const name of ["manifest.ts", "manifest.json", "manifest.webmanifest"]) {
      expect(existsSync(path.join(SRC_ROOT, "app", name))).toBe(false);
    }
    const rootLayout = readFileSync(path.join(SRC_ROOT, "app/layout.tsx"), "utf-8");
    expect(rootLayout).not.toMatch(/manifest/);
  });
});

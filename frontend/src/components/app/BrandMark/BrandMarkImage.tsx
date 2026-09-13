/**
 * The existing HealthTrend mark (`src/app/icon.svg`) -- a noisy measurement reduced to a trend with
 * a band around it -- redrawn as markup `next/og`'s `ImageResponse` can rasterise, so the
 * home-screen PNGs are generated deterministically at build time from the same artwork instead of
 * being a separately drawn, hand-exported brand asset.
 *
 * Same geometry and colours as `icon.svg`, varied only in framing:
 * - `rounded`: the favicon exactly, a rounded square on a transparent ground;
 * - `fullBleed`: a square filling the canvas, for iOS, which rounds and would blacken transparency;
 * - `maskable`: full-bleed ground with the mark shrunk into the central safe zone a launcher may
 *   crop to a circle. Achieved by widening the viewBox, so no transform is needed.
 */

const GROUND = "#2f5d50";
const INK = "#fbfaf8";
const TREND = "M6 11C12 16 17 17.5 26 22.5";

export type BrandMarkFraming = "rounded" | "fullBleed" | "maskable";

export function BrandMarkImage({ size, framing }: { size: number; framing: BrandMarkFraming }) {
  // The maskable safe zone is a centred circle of 40% radius; a 53.33-unit view of the 32-unit
  // mark keeps its furthest stroke edge at about 32% of the canvas from the centre.
  const viewBox = framing === "maskable" ? "-10.67 -10.67 53.33 53.33" : "0 0 32 32";

  return (
    <div style={{ display: "flex", width: size, height: size }}>
      <svg width={size} height={size} viewBox={viewBox} xmlns="http://www.w3.org/2000/svg">
        {framing === "rounded" ? (
          <rect width="32" height="32" rx="7" fill={GROUND} />
        ) : (
          <rect x="-10.67" y="-10.67" width="53.33" height="53.33" fill={GROUND} />
        )}
        <path
          d={TREND}
          fill="none"
          stroke="rgba(251,250,248,0.22)"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={TREND}
          fill="none"
          stroke={INK}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

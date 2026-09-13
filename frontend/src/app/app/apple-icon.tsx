import { ImageResponse } from "next/og";
import { BrandMarkImage } from "@/components/app/BrandMark/BrandMarkImage";

// The iOS home-screen icon for `/app`, rendered at build time from the existing brand mark.
// Full-bleed because iOS applies its own rounding and turns transparency black.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandMarkImage size={180} framing="fullBleed" />, size);
}

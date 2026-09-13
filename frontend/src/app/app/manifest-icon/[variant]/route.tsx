import { ImageResponse } from "next/og";
import { BrandMarkImage } from "@/components/app/BrandMark/BrandMarkImage";
import { MANIFEST_ICON_VARIANTS, type ManifestIconVariant } from "@/lib/app/manifest";

// Every variant is rendered once at build time; any other path is a 404, not a render.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return MANIFEST_ICON_VARIANTS.map((variant) => ({ variant }));
}

export async function GET(_request: Request, { params }: RouteContext<"/app/manifest-icon/[variant]">) {
  const { variant } = (await params) as { variant: ManifestIconVariant };
  const size = variant === "192" ? 192 : 512;
  const framing = variant === "maskable-512" ? "maskable" : "rounded";
  return new ImageResponse(<BrandMarkImage size={size} framing={framing} />, {
    width: size,
    height: size,
  });
}

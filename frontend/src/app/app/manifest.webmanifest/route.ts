import { appManifest } from "@/lib/app/manifest";

// Built once, at build time: the manifest depends on nothing about the request.
export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(appManifest()), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}

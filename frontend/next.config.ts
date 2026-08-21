import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 otherwise (re)writes AGENTS.md/CLAUDE.md into this directory on every
  // `next dev`/`next build`. Useful for a project that wants it, but it is generated
  // noise here and not part of the product.
  agentRules: false,
};

export default nextConfig;

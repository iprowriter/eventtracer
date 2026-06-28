import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // This frontend is a self-contained package nested inside the NestJS monorepo,
  // which has its own root package-lock.json. Pin the workspace root to this
  // folder so Next doesn't guess the monorepo root from the sibling lockfile.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Emit a self-contained server bundle (.next/standalone) for a small Docker image.
  output: "standalone",
};

export default nextConfig;

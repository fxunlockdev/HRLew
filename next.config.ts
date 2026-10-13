import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // A stray lockfile further up the filesystem makes Next infer the wrong
  // workspace root; pin it to this project.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),

  experimental: {
    // The CSV importer posts its parsed rows to a server action.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  // No remotePatterns: uploaded logos and resumes are served from this origin
  // via /api/files, and the few places that render an externally hosted logo
  // use a plain <img>, not next/image.
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/runtime-heavy packages must stay external to the server bundle.
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "handlebars",
    "@prisma/adapter-better-sqlite3",
    "better-sqlite3",
  ],
};

export default nextConfig;

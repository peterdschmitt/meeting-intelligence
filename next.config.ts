import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-ical (and its rrule/timezone deps) hit `s.BigInt is not a function` when
  // Turbopack bundles them. Mark as external so Node `require`s them at runtime
  // from node_modules instead of going through the bundler.
  serverExternalPackages: ['node-ical', 'rrule'],
};

export default nextConfig;

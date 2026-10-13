import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Where this system is mounted.
 *
 * Standalone it is `/clothing`. When the platform runs an organization's own
 * copy of it, the process is started with `SYSTEM_BASE_PATH=/{org}/clothing` so
 * the customer's URL, this app's links and its asset URLs are all the same thing.
 * Read here rather than hardcoded: Next bakes `basePath` into the build, so a
 * literal path would 404 every organization's clone.
 */
const basePath = process.env.SYSTEM_BASE_PATH ?? "/clothing";

const nextConfig: NextConfig = {
  basePath,
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
};

export default withNextIntl(nextConfig);
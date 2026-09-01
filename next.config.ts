import type { NextConfig } from "next";

const isVercelBuild = process.env.CNP_DEPLOY_TARGET === "vercel" || process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // Menu photos never change without a new filename, so let the browser and the
  // CDN keep them for a year instead of revalidating on every page view.
  async headers() {
    return [
      {
        source: "/:dir(menu-images|owner-menu|payment)/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, stale-while-revalidate=86400, immutable" },
        ],
      },
    ];
  },
  ...(isVercelBuild ? {
    typescript: {
      tsconfigPath: "tsconfig.vercel.json",
    },
  } : {}),
};

export default nextConfig;

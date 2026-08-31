import type { NextConfig } from "next";

const isVercelBuild = process.env.CNP_DEPLOY_TARGET === "vercel" || process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  ...(isVercelBuild ? {
    typescript: {
      tsconfigPath: "tsconfig.vercel.json",
    },
  } : {}),
};

export default nextConfig;

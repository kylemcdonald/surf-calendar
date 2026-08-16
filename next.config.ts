import type { NextConfig } from "next";

const isGithubPagesBuild = process.env.SURF_PAGES_BUILD === "true";

const nextConfig: NextConfig = {
  ...(isGithubPagesBuild
    ? {
        assetPrefix: "/surf-calendar",
        output: "export" as const,
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;

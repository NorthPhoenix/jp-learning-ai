import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["@mastra/*"],
  transpilePackages: ["@repo/db"],
}

export default nextConfig

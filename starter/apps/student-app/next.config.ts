import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@semester/auth",
    "@semester/contracts",
    "@semester/database",
    "@semester/permissions",
    "@semester/policy",
  ],
  serverExternalPackages: ["pg"],
};

export default nextConfig;

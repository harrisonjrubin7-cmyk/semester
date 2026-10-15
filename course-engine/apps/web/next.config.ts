import type { NextConfig } from "next";

const developmentScriptPolicy = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
const transportPolicy = process.env.NODE_ENV === "production" ? "; upgrade-insecure-requests" : "";

const securityHeaders = [
  { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'${developmentScriptPolicy}; connect-src 'self' https: http://localhost:8000${transportPolicy}` },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default config;

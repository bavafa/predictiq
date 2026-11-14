import type { NextConfig } from "next";

// Local dev/preview only: when API_PROXY_URL is set (for example
// http://127.0.0.1:8000), /api/v1/* is proxied to a locally running FastAPI.
// On Vercel the vercel.json rewrite sends /api/v1/* to the Python function,
// and API_PROXY_URL is not set.
const apiProxy = process.env.API_PROXY_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return apiProxy ? [{ source: "/api/v1/:path*", destination: `${apiProxy}/api/v1/:path*` }] : [];
  },
};

export default nextConfig;

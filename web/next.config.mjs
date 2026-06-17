/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy API calls through the web origin so the browser never needs to reach
  // the backend directly (no CORS, single tunnel). The web server (this VM)
  // forwards /api/v1/* to the local NestJS backend on :8080.
  async rewrites() {
    const backend = process.env.BACKEND_ORIGIN || "http://localhost:8080";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backend}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

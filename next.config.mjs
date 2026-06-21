const privateRoutePrefixes = [
  "/admin",
  "/ai",
  "/api",
  "/auth",
  "/billing",
  "/cont",
  "/demo",
  "/licenta-exam",
  "/materiale",
  "/materii",
  "/onboarding",
  "/r",
  "/review-reward",
  "/setup",
  "/statistici",
  "/testele-mele"
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./data/subjects.json", "./data/questions/**/*.json"]
  },
  webpack(config, { dev }) {
    if (dev) {
      // Disable the persistent webpack cache in dev to avoid intermittent
      // missing chunk errors on local Windows setups after route refactors.
      config.cache = false;
    }

    return config;
  },
  async rewrites() {
    return [
      { source: "/materiale", destination: "/ai" },
      { source: "/materiale/:path*", destination: "/ai/:path*" }
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" }
        ]
      },
      ...privateRoutePrefixes.map((source) => ({
        source: `${source}/:path*`,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]
      }))
    ];
  },
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/materii.html", destination: "/materii", permanent: true },
      { source: "/licenta-exam.html", destination: "/licenta-exam", permanent: true },
      { source: "/ai", destination: "/materiale", permanent: false },
      { source: "/ai/:path*", destination: "/materiale/:path*", permanent: false }
    ];
  }
};

export default nextConfig;

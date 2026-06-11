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

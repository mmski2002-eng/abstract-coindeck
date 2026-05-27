import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

function buildContentSecurityPolicy() {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  const styleSrc = ["'self'", "'unsafe-inline'"];

  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    `script-src ${scriptSrc.join(" ")}`,
    `style-src ${styleSrc.join(" ")}`,
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://assets.coingecko.com",
    "media-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "connect-src 'self' https://api.testnet.abs.xyz https://api.mainnet.abs.xyz wss://api.testnet.abs.xyz wss://api.mainnet.abs.xyz https://api.coingecko.com https://assets.coingecko.com",
  ].join("; ");
}

const nextConfig: NextConfig = {
  experimental: {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

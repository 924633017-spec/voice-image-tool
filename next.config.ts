import type { NextConfig } from "next";
import path from "path";

const remoteHosts = new Set(["images.unsplash.com"]);

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const ossPublicUrl = process.env.OSS_PUBLIC_URL;
const ossEndpoint = process.env.OSS_ENDPOINT;

for (const candidate of [siteUrl, ossPublicUrl, ossEndpoint]) {
  if (!candidate) continue;
  try {
    remoteHosts.add(new URL(candidate).hostname);
  } catch {}
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/register": ["./src/generated/prisma/**/*"],
    "/api/upload": ["./src/generated/prisma/**/*"],
    "/api/projects/*": ["./src/generated/prisma/**/*"],
    "/api/transcribe": ["./src/generated/prisma/**/*"],
    "/api/files/*": ["./src/generated/prisma/**/*"],
    "/api/health": ["./src/generated/prisma/**/*"],
  },
  images: {
    remotePatterns: Array.from(remoteHosts).map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "path";

const remoteHosts = new Set(["images.unsplash.com"]);

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const ossPublicUrl = process.env.OSS_PUBLIC_URL;
const ossEndpoint = process.env.OSS_ENDPOINT;
const s3Endpoint = process.env.S3_ENDPOINT;
const s3PublicUrl = process.env.S3_PUBLIC_URL;

for (const candidate of [siteUrl, ossPublicUrl, ossEndpoint, s3Endpoint, s3PublicUrl]) {
  if (!candidate) continue;
  try {
    remoteHosts.add(new URL(candidate).hostname);
  } catch {}
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  devIndicators: false,
  images: {
    remotePatterns: Array.from(remoteHosts).map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
};

export default nextConfig;

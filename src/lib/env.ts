const defaultSiteUrl = "http://127.0.0.1:3001";

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/u, "");
}

export function getSiteUrl() {
  return trimTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL || defaultSiteUrl);
}

export function getAuthUrl() {
  return trimTrailingSlash(process.env.AUTH_URL || getSiteUrl());
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function isObjectStorageEnabled() {
  return Boolean(
    (process.env.OSS_BUCKET &&
      process.env.OSS_ENDPOINT &&
      process.env.OSS_ACCESS_KEY_ID &&
      process.env.OSS_ACCESS_KEY_SECRET) ||
    isS3StorageEnabled(),
  );
}

export function isS3StorageEnabled() {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ENDPOINT &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_ACCESS_KEY_SECRET,
  );
}

export function getStoragePublicBaseUrl() {
  // S3/R2 public URL takes precedence
  const s3PublicUrl = trimTrailingSlash(process.env.S3_PUBLIC_URL || "");
  if (s3PublicUrl) return s3PublicUrl;

  const customCdn = trimTrailingSlash(process.env.OSS_PUBLIC_URL || "");
  if (customCdn) return customCdn;

  const bucket = process.env.OSS_BUCKET?.trim();
  const endpoint = trimTrailingSlash(process.env.OSS_ENDPOINT || "");
  if (!bucket || !endpoint) return "";

  try {
    const endpointUrl = new URL(endpoint);
    return `https://${bucket}.${endpointUrl.host}`;
  } catch {
    return "";
  }
}

export function shouldAllowLocalFileStorage() {
  return !isProduction() || process.env.ALLOW_LOCAL_UPLOADS === "true";
}

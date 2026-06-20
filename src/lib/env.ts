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
    process.env.OSS_BUCKET &&
      process.env.OSS_ENDPOINT &&
      process.env.OSS_ACCESS_KEY_ID &&
      process.env.OSS_ACCESS_KEY_SECRET,
  );
}

export function isVercelBlobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function shouldAllowLocalFileStorage() {
  return !isProduction() || process.env.ALLOW_LOCAL_UPLOADS === "true";
}

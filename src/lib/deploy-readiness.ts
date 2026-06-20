import {
  getAuthUrl,
  getSiteUrl,
  isObjectStorageEnabled,
  isProduction,
  isVercelBlobEnabled,
  shouldAllowLocalFileStorage,
} from "./env";

const baseRequiredEnv = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "AUTH_TRUST_HOST",
  "NEXT_PUBLIC_SITE_URL",
] as const;

const ossRequiredEnv = [
  "OSS_ENDPOINT",
  "OSS_BUCKET",
  "OSS_ACCESS_KEY_ID",
  "OSS_ACCESS_KEY_SECRET",
] as const;

const speechRequiredEnv = [
  "ALIYUN_SPEECH_APP_KEY",
  "ALIYUN_SPEECH_ACCESS_KEY_ID",
  "ALIYUN_SPEECH_ACCESS_KEY_SECRET",
] as const;

function isFilled(name: string) {
  return Boolean(process.env[name]?.trim());
}

export function getMissingEnv(names: readonly string[]) {
  return names.filter((name) => !isFilled(name));
}

export function isSpeechRecognitionEnabled() {
  return speechRequiredEnv.every((name) => isFilled(name));
}

export function getStorageMode() {
  if (isVercelBlobEnabled()) return "blob";
  if (isObjectStorageEnabled()) return "oss";
  if (shouldAllowLocalFileStorage()) return "local";
  return "db"; // built-in database storage fallback
}

export function getDeployReadiness() {
  const mode = isProduction() ? "production" : "development";
  const missingBaseEnv = getMissingEnv(baseRequiredEnv);
  const storageMode = getStorageMode();
  const missingOssEnv = getMissingEnv(ossRequiredEnv);
  const missingSpeechEnv = getMissingEnv(speechRequiredEnv);
  const speechEnabled = isSpeechRecognitionEnabled();

  const authTrustHostValid = process.env.AUTH_TRUST_HOST === "true";
  const shareUrlConfigured =
    Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()) &&
    !/127(?:\.\d+){3}|localhost|::1/iu.test(getSiteUrl());
  const authUrlConfigured =
    Boolean(process.env.AUTH_URL?.trim()) &&
    !/127(?:\.\d+){3}|localhost|::1/iu.test(getAuthUrl());

  const blockers: string[] = [];

  if (missingBaseEnv.length > 0) {
    blockers.push(`missing_base_env:${missingBaseEnv.join(",")}`);
  }

  if (!authTrustHostValid) {
    blockers.push("auth_trust_host_not_true");
  }

  if (!shareUrlConfigured) {
    blockers.push("site_url_not_public");
  }

  if (!authUrlConfigured) {
    blockers.push("auth_url_not_public");
  }

  const storageReady = true; // db fallback always works

  if (mode === "production" && !storageReady) {
    blockers.push("storage_not_ready");
  }

  return {
    ok: blockers.length === 0,
    mode,
    urls: {
      siteUrl: getSiteUrl(),
      authUrl: getAuthUrl(),
    },
    storage: {
      mode: storageMode,
      ready: storageReady,
      missingEnv: storageReady ? [] : [...missingOssEnv, "BLOB_READ_WRITE_TOKEN"].filter((name) => !isFilled(name)),
      localFallbackAllowed: shouldAllowLocalFileStorage(),
    },
    speech: {
      ready: speechEnabled,
      missingEnv: speechEnabled ? [] : missingSpeechEnv,
    },
    auth: {
      trustHostValid: authTrustHostValid,
    },
    database: {
      ready: missingBaseEnv.filter((name) => name === "DATABASE_URL" || name === "DIRECT_URL").length === 0,
      missingEnv: missingBaseEnv.filter((name) => name === "DATABASE_URL" || name === "DIRECT_URL"),
    },
    blockers,
  };
}


const baseRequiredEnv = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "AUTH_TRUST_HOST",
  "NEXT_PUBLIC_SITE_URL",
];

const ossRequiredEnv = [
  "OSS_ENDPOINT",
  "OSS_BUCKET",
  "OSS_ACCESS_KEY_ID",
  "OSS_ACCESS_KEY_SECRET",
];

const speechRequiredEnv = [
  "ALIYUN_SPEECH_APP_KEY",
  "ALIYUN_SPEECH_ACCESS_KEY_ID",
  "ALIYUN_SPEECH_ACCESS_KEY_SECRET",
];

function isFilled(name) {
  return Boolean(process.env[name] && process.env[name].trim());
}

function report(label, names) {
  const missing = names.filter((name) => !isFilled(name));
  if (missing.length === 0) {
    console.log(`PASS ${label}`);
    return true;
  }

  console.log(`FAIL ${label}: ${missing.join(", ")}`);
  return false;
}

const checks = [
  report("base env", baseRequiredEnv),
  report("oss env", ossRequiredEnv),
  report("speech env", speechRequiredEnv),
];

if (process.env.AUTH_TRUST_HOST !== "true") {
  console.log("FAIL AUTH_TRUST_HOST must be true");
  checks.push(false);
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
if (/127(?:\.\d+){3}|localhost|::1/iu.test(siteUrl)) {
  console.log("FAIL NEXT_PUBLIC_SITE_URL must be a public domain");
  checks.push(false);
}

if (process.env.ALLOW_LOCAL_UPLOADS === "true") {
  console.log("FAIL ALLOW_LOCAL_UPLOADS should be false in production");
  checks.push(false);
}

if (checks.every(Boolean)) {
  console.log("Deployment check passed.");
  process.exit(0);
}

console.log("Deployment check failed.");
process.exit(1);


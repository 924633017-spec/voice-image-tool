import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { isObjectStorageEnabled, isVercelBlobEnabled, shouldAllowLocalFileStorage } from "./env";
import { prisma } from "./prisma";

type UploadedAsset = {
  url: string;
  storageKey: string;
  size: number;
  localPath?: string;
};

function normalizeObjectKey(objectKey: string) {
  return objectKey.replace(/^\/+/u, "");
}

function buildObjectKey(type: "image" | "audio", filename: string) {
  const datePrefix = new Date().toISOString().slice(0, 10).replaceAll("-", "/");
  return `${type}/${datePrefix}/${filename}`;
}

async function saveToVercelBlob(
  type: "image" | "audio",
  filename: string,
  buffer: Buffer,
): Promise<UploadedAsset> {
  const objectKey = normalizeObjectKey(buildObjectKey(type, filename));

  const result = await put(objectKey, buffer, {
    access: "public",
    addRandomSuffix: false,
  });

  return {
    url: result.url,
    storageKey: objectKey,
    size: buffer.length,
  };
}

async function saveToLocal(
  type: "image" | "audio",
  filename: string,
  buffer: Buffer,
): Promise<UploadedAsset> {
  const uploadsDir = path.join(process.cwd(), "public", "uploads", type);
  await fs.mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, filename);
  await fs.writeFile(filePath, buffer);
  return {
    url: `/uploads/${type}/${filename}`,
    storageKey: `uploads/${type}/${filename}`,
    size: buffer.length,
    localPath: filePath,
  };
}

function hmacSha1Base64(secret: string, content: string) {
  return crypto.createHmac("sha1", secret).update(content).digest("base64");
}

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/u, "");
}

function getStoragePublicBaseUrl() {
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

async function saveToOss(
  type: "image" | "audio",
  filename: string,
  mimeType: string,
  buffer: Buffer,
): Promise<UploadedAsset> {
  const endpoint = process.env.OSS_ENDPOINT!;
  const bucket = process.env.OSS_BUCKET!;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID!;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET!;
  const objectKey = normalizeObjectKey(buildObjectKey(type, filename));
  const publicBaseUrl = getStoragePublicBaseUrl();
  const dateValue = new Date().toUTCString();
  const resourcePath = `/${bucket}/${objectKey}`;
  const stringToSign = ["PUT", "", mimeType, dateValue, resourcePath].join("\n");
  const authorization = `OSS ${accessKeyId}:${hmacSha1Base64(accessKeySecret, stringToSign)}`;
  const uploadUrl = `${endpoint.replace(/\/+$/u, "")}/${objectKey}`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      Date: dateValue,
      "Content-Type": mimeType,
      "x-oss-object-acl": "public-read",
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`oss_upload_failed:${response.status}:${errorBody}`);
  }

  return {
    url: publicBaseUrl ? `${publicBaseUrl}/${objectKey}` : uploadUrl,
    storageKey: objectKey,
    size: buffer.length,
  };
}

async function saveToDB(
  buffer: Buffer,
  mimeType: string,
): Promise<UploadedAsset> {
  const record = await prisma.storedFile.create({
    data: {
      data: new Uint8Array(buffer),
      mimeType,
    },
  });

  return {
    url: `/api/files/${record.id}`,
    storageKey: record.id,
    size: buffer.length,
  };
}

export async function storeUploadedAsset({
  buffer,
  filename,
  mimeType,
  type,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  type: "image" | "audio";
}) {
  // 1. Vercel Blob (free, no external account needed)
  if (isVercelBlobEnabled()) {
    return saveToVercelBlob(type, filename, buffer);
  }

  // 2. Alibaba Cloud OSS
  if (isObjectStorageEnabled()) {
    return saveToOss(type, filename, mimeType, buffer);
  }

  // 3. Local disk (dev only)
  if (shouldAllowLocalFileStorage()) {
    return saveToLocal(type, filename, buffer);
  }

  // 4. Database fallback (always available, works everywhere)
  return saveToDB(buffer, mimeType);
}

export async function readStoredAsset(assetUrl: string) {
  if (!assetUrl) {
    throw new Error("missing_asset_url");
  }

  if (/^https?:\/\//iu.test(assetUrl)) {
    const response = await fetch(assetUrl);
    if (!response.ok) {
      throw new Error(`asset_fetch_failed:${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  const normalizedPath = assetUrl.startsWith("/") ? assetUrl.slice(1) : assetUrl;
  const filePath = path.join(process.cwd(), "public", normalizedPath);
  return fs.readFile(filePath);
}

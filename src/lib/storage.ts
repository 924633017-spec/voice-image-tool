import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getStoragePublicBaseUrl, isObjectStorageEnabled, isS3StorageEnabled, shouldAllowLocalFileStorage } from "./env";

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

async function saveToLocal(type: "image" | "audio", filename: string, buffer: Buffer): Promise<UploadedAsset> {
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

async function saveToOss(type: "image" | "audio", filename: string, mimeType: string, buffer: Buffer): Promise<UploadedAsset> {
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

function createS3Client() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT!,
    region: process.env.S3_REGION || "auto",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_ACCESS_KEY_SECRET!,
    },
    forcePathStyle: true,
  });
}

async function saveToS3(
  type: "image" | "audio",
  filename: string,
  mimeType: string,
  buffer: Buffer,
): Promise<UploadedAsset> {
  const bucket = process.env.S3_BUCKET!;
  const objectKey = normalizeObjectKey(buildObjectKey(type, filename));
  const client = createS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  const publicBaseUrl = getStoragePublicBaseUrl();
  const publicUrl = publicBaseUrl
    ? `${publicBaseUrl}/${objectKey}`
    : `${trimTrailingSlash(process.env.S3_ENDPOINT!)}/${bucket}/${objectKey}`;

  return {
    url: publicUrl,
    storageKey: objectKey,
    size: buffer.length,
  };
}

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/u, "");
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
  if (isS3StorageEnabled()) {
    return saveToS3(type, filename, mimeType, buffer);
  }

  if (isObjectStorageEnabled()) {
    return saveToOss(type, filename, mimeType, buffer);
  }

  if (!shouldAllowLocalFileStorage()) {
    throw new Error("local_storage_disabled");
  }

  return saveToLocal(type, filename, buffer);
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

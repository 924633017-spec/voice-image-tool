import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import crypto from "crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { storeUploadedAsset } from "@/lib/storage";

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const AUDIO_MIME_TO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const execFileAsync = promisify(execFile);

async function getAudioDurationWithFfprobe(filePath: string) {
  try {
    const { stdout } = await execFileAsync("/opt/homebrew/bin/ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const value = Number(stdout.trim());
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Number(value.toFixed(2));
  } catch {
    return 0;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = new URL(req.url).searchParams.get("type") || "image";

  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const mimeMap = type === "audio" ? AUDIO_MIME_TO_EXT : IMAGE_MIME_TO_EXT;
  const maxBytes = type === "audio" ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
  const ext = mimeMap[file.type];

  if (!ext) {
    return NextResponse.json(
      { error: type === "audio" ? "暂不支持这个音频格式" : "暂不支持这个图片格式" },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > maxBytes) {
    return NextResponse.json(
      {
        error:
          type === "audio"
            ? `音频不能超过 ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)}MB`
            : `图片不能超过 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB`,
      },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${crypto.randomUUID()}.${ext}`;
  const durationValue = Number(formData.get("duration") ?? 0);
  const duration =
    type === "audio" && Number.isFinite(durationValue) && durationValue > 0
      ? Number(durationValue.toFixed(2))
      : 0;

  const asset = await storeUploadedAsset({
    buffer,
    filename,
    mimeType: file.type,
    type: type === "audio" ? "audio" : "image",
  });

  const actualDuration =
    type === "audio" && asset.localPath ? await getAudioDurationWithFfprobe(asset.localPath) : 0;
  const safeDuration =
    type === "audio"
      ? actualDuration || duration
      : 0;

  return NextResponse.json({
    url: asset.url,
    filename,
    size: asset.size,
    duration: safeDuration,
  });
}

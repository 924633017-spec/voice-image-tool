import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readStoredAsset } from "@/lib/storage";

async function getAliyunToken(): Promise<string> {
  const accessKeyId = process.env.ALIYUN_SPEECH_ACCESS_KEY_ID!;
  const accessKeySecret = process.env.ALIYUN_SPEECH_ACCESS_KEY_SECRET!;

  const res = await fetch("https://nls-meta.cn-shanghai.aliyuncs.com/pop/2018-05-18/tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Basic " + Buffer.from(`${accessKeyId}:${accessKeySecret}`).toString("base64"),
      "Date": new Date().toUTCString(),
    },
    body: JSON.stringify({ version: "2018-05-18" }),
  });

  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  const data = await res.json();
  return data.Token?.Id ?? "";
}

function buildTimedSegments(
  fullText: string,
  duration: number,
): Array<{ text: string; startTime: number; endTime: number }> {
  if (!fullText.trim()) {
    return [{ text: "（未识别到语音）", startTime: 0, endTime: duration }];
  }

  // 按标点分句
  const rawSegments = fullText.split(/(?<=[。，！？,.!?；;，])/g).filter(Boolean);
  if (rawSegments.length === 0) {
    return [{ text: fullText.trim(), startTime: 0, endTime: duration }];
  }

  // 按字符数加权分配时间
  const totalChars = rawSegments.reduce((sum, s) => sum + s.length, 0) || 1;
  let cursor = 0;
  return rawSegments.map((text) => {
    const weight = text.length / totalChars;
    const startTime = Number(cursor.toFixed(2));
    cursor += weight * duration;
    const endTime = Number(Math.min(duration, cursor).toFixed(2));
    return { text: text.trim(), startTime, endTime };
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const accessKeyId = process.env.ALIYUN_SPEECH_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_SPEECH_ACCESS_KEY_SECRET;
  const appKey = process.env.ALIYUN_SPEECH_APP_KEY;

  if (!accessKeyId || !accessKeySecret || !appKey) {
    return NextResponse.json({ error: "未配置服务端语音识别" }, { status: 503 });
  }

  // Read request body once
  let audioUrl: string;
  let duration: number;
  try {
    const body = await req.json();
    audioUrl = body.audioUrl;
    duration = Number.isFinite(body.duration) && body.duration > 0 ? body.duration : 5;
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }

  if (!audioUrl) {
    return NextResponse.json({ error: "缺少音频地址" }, { status: 400 });
  }

  try {
    const audioBuffer = await readStoredAsset(audioUrl);
    const audioBase64 = audioBuffer.toString("base64");

    const token = await getAliyunToken();
    if (!token) throw new Error("Aliyun token unavailable");

    // 一句话识别（适合 60s 内短音频）
    const asrUrl = new URL("https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr");
    asrUrl.searchParams.set("appkey", appKey);
    // Let Aliyun auto-detect format and sample rate
    asrUrl.searchParams.set("enable_punctuation_prediction", "true");
    asrUrl.searchParams.set("enable_inverse_text_normalization", "true");
    asrUrl.searchParams.set("max_sentence_silence", "800");

    const asrRes = await fetch(asrUrl.toString(), {
      method: "POST",
      headers: {
        "X-NLS-Token": token,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(audioBase64.length),
      },
      body: Buffer.from(audioBase64, "base64"),
    });

    if (asrRes.ok) {
      const asrData = await asrRes.json();
      const fullText = (asrData.result ?? "").trim();

      if (fullText) {
        const segments = buildTimedSegments(fullText, duration);
        return NextResponse.json({
          text: fullText,
          segments: segments.map((s) => ({
            text: s.text,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        });
      }
    }
  } catch (err) {
    console.error("Transcribe error:", err);
  }

  // Fallback: return empty with a hint
  return NextResponse.json({
    text: "",
    segments: [],
  });
}

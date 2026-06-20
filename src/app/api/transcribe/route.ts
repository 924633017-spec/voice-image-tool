import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readStoredAsset } from "@/lib/storage";

// 阿里云一句话识别 REST API
// 文档: https://help.aliyun.com/document_detail/324261.html

async function getAliyunToken(): Promise<string> {
  const accessKeyId = process.env.ALIYUN_SPEECH_ACCESS_KEY_ID!;
  const accessKeySecret = process.env.ALIYUN_SPEECH_ACCESS_KEY_SECRET!;

  const res = await fetch("https://nls-meta.cn-shanghai.aliyuncs.com/pop/2018-05-18/tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Basic " + Buffer.from(`${accessKeyId}:${accessKeySecret}`).toString("base64"),
    },
    body: JSON.stringify({ version: "2018-05-18" }),
  });

  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  const data = await res.json();
  return data.Token?.Id ?? "";
}

async function recognizeSpeech(audioBase64: string): Promise<{
  text: string;
  sentences: { text: string; beginTime: number; endTime: number }[];
}> {
  const token = await getAliyunToken();
  if (!token) throw new Error("Failed to get Aliyun token");

  // 一句话识别 API
  const res = await fetch("https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr", {
    method: "POST",
    headers: {
      "X-NLS-Token": token,
      "Content-Type": "application/octet-stream",
      "Content-Length": String(audioBase64.length),
    },
    body: Buffer.from(audioBase64, "base64"),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ASR failed (${res.status}): ${errText}`);
  }

  const result = await res.json();
  const fullText = result.result ?? "";

  // 阿里云一句话识别不返回时间戳，这里我们做简单分割
  // 每句话按标点或长度切分，估算时间
  const segments = fullText.split(/(?<=[。，！？,.!?])/g).filter(Boolean);
  const totalDuration = 5; // 估算值，后续可用实际录音时长
  const sentences = segments.map((text: string, i: number) => ({
    text: text.trim(),
    beginTime: Math.round((i / segments.length) * totalDuration * 1000),
    endTime: Math.round(((i + 1) / segments.length) * totalDuration * 1000),
  }));

  return { text: fullText, sentences: sentences.filter((s: { text: string }) => s.text) };
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

  try {
    const { audioUrl, duration } = await req.json();

    // 读取本地音频文件
    if (!audioUrl) {
      return NextResponse.json({ error: "缺少音频地址" }, { status: 400 });
    }

    const audioBuffer = await readStoredAsset(audioUrl);
    const audioBase64 = audioBuffer.toString("base64");

    const result = await recognizeSpeech(audioBase64);
    const fallbackDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const segmentCount = result.sentences.length || 1;

    return NextResponse.json({
      text: result.text,
      segments: result.sentences.map((s, index) => ({
        text: s.text,
        startTime:
          fallbackDuration > 0
            ? Number((((index / segmentCount) * fallbackDuration)).toFixed(2))
            : s.beginTime / 1000,
        endTime:
          fallbackDuration > 0
            ? Number(((((index + 1) / segmentCount) * fallbackDuration)).toFixed(2))
            : s.endTime / 1000,
      })),
    });
  } catch (error) {
    console.error("Transcribe error:", error);
    return NextResponse.json(
      { error: "语音识别失败，请稍后重试" },
      { status: 500 }
    );
  }
}

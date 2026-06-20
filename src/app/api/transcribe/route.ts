import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readStoredAsset } from "@/lib/storage";

// 阿里云录音文件识别 REST API
// 文档: https://help.aliyun.com/document_detail/90726.html

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

async function recognizeFileTrans(
  audioBase64: string,
  appKey: string,
  token: string,
  durationSeconds: number,
): Promise<{ text: string; sentences: { text: string; beginTime: number; endTime: number }[] }> {
  // 录音文件识别 — 提交任务
  const taskRes = await fetch("https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/fileTrans", {
    method: "POST",
    headers: {
      "X-NLS-Token": token,
      "Content-Type": "application/octet-stream",
      "Content-Length": String(audioBase64.length),
    },
    body: Buffer.from(audioBase64, "base64"),
  });

  if (!taskRes.ok) {
    throw new Error(`FileTrans submit failed: ${taskRes.status}`);
  }

  const taskData = await taskRes.json();
  if (taskData.status !== 200 || !taskData.id) {
    throw new Error(`FileTrans task error: ${taskData.status_text || "unknown"}`);
  }

  // 轮询获取结果
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const pollRes = await fetch(
      `https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/fileTrans/${taskData.id}`,
      {
        headers: { "X-NLS-Token": token },
      },
    );

    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();

    if (pollData.status === "SUCCESS") {
      const sentences = (pollData.result?.sentences ?? []).map(
        (s: { text: string; begin_time: number; end_time: number }) => ({
          text: s.text?.trim() ?? "",
          beginTime: (s.begin_time ?? 0) / 1000,
          endTime: (s.end_time ?? 0) / 1000,
        }),
      ).filter((s: { text: string }) => s.text);

      const fullText = sentences.map((s: { text: string }) => s.text).join("");
      return { text: fullText, sentences };
    }

    if (pollData.status === "FAILED") {
      throw new Error(`FileTrans failed: ${pollData.status_text || "unknown"}`);
    }
  }

  throw new Error("FileTrans timed out");
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

    if (!audioUrl) {
      return NextResponse.json({ error: "缺少音频地址" }, { status: 400 });
    }

    const audioBuffer = await readStoredAsset(audioUrl);
    const audioBase64 = audioBuffer.toString("base64");
    const dur = Number.isFinite(duration) && duration > 0 ? duration : 5;

    const token = await getAliyunToken();
    const result = await recognizeFileTrans(audioBase64, appKey, token, dur);

    return NextResponse.json({
      text: result.text,
      segments: result.sentences.map((s) => ({
        text: s.text,
        startTime: s.beginTime,
        endTime: s.endTime,
      })),
    });
  } catch (error) {
    // Fallback: 一句话识别（无时间戳，手动分句）
    try {
      const { audioUrl, duration } = await req.json();
      const audioBuffer = await readStoredAsset(audioUrl);
      const audioBase64 = audioBuffer.toString("base64");
      const dur = Number.isFinite(duration) && duration > 0 ? duration : 5;

      const token = await getAliyunToken();
      const asrRes = await fetch("https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr", {
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
        const fullText = asrData.result ?? "";

        // 按标点分句，根据实际时长均匀分配时间
        const rawSegments = fullText.split(/(?<=[。，！？,.!?；;])/g).filter(Boolean);
        const sentences = rawSegments.length > 0
          ? rawSegments.map((text: string, i: number) => ({
              text: text.trim(),
              startTime: Number(((i / rawSegments.length) * dur).toFixed(2)),
              endTime: Number((((i + 1) / rawSegments.length) * dur).toFixed(2)),
            }))
          : [{ text: fullText, startTime: 0, endTime: dur }];

        return NextResponse.json({
          text: fullText,
          segments: sentences.filter((s: { text: string; startTime: number; endTime: number }) => s.text),
        });
      }
    } catch {}

    return NextResponse.json(
      { error: "语音识别失败，请稍后重试" },
      { status: 500 },
    );
  }
}

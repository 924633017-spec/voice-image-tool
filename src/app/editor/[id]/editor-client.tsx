"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";

type Sub = { id: string; text: string; startTime: number; endTime: number };
type AudioData = { id: string; audioUrl: string; duration: number; subtitles: Sub[] };
type Spot = { id: string; x: number; y: number; color: string; title: string; audio: AudioData | null };
type ProjectSettings = {
  playerPosition?: {
    x: number;
    y: number;
  };
  imageSize?: {
    width: number;
    height: number;
  };
};
type Proj = { id: string; title: string; coverImage: string | null; hotspots: Spot[]; settings?: string | null };
type BrowserSpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};
type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechRecognitionResult>;
};
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const COLORS = ["#1f1e1b", "#615c53", "#9a9386", "#7e7668", "#b9b0a2"];
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

function formatSeconds(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function recordingProgressLabel(recordedCount: number, totalSpots: number) {
  if (recordedCount <= 0) return "未开始";
  return `${String(recordedCount).padStart(2, "0")} / ${String(Math.max(1, totalSpots)).padStart(2, "0")}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/u, "");
}

function isLoopbackHost(hostname: string) {
  return /^(localhost|127(?:\.\d+){3}|::1)$/iu.test(hostname);
}

function buildShareUrl(projectId: string) {
  const preferredOrigin = normalizeOrigin(SITE_URL);
  const runtimeOrigin =
    typeof window !== "undefined" ? normalizeOrigin(window.location.origin) : "";
  const base = preferredOrigin || runtimeOrigin;

  if (!base) return "";

  try {
    return new URL(`/play/${projectId}`, `${base}/`).toString();
  } catch {
    return `${base}/play/${projectId}`;
  }
}

function isLocalShareUrl(url: string) {
  if (!url) return true;
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch {
    return true;
  }
}

function absUrl(path: string) {
  return path.startsWith("http")
    ? path
    : `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

async function toBase64(url: string): Promise<string> {
  const response = await fetch(absUrl(url));
  if (!response.ok) throw new Error("failed");
  const blob = await response.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

async function getImageSize(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("image size failed"));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function splitSubtitlePhrase(text: string) {
  const chunks = text
    .split(/(?<=[，。！？；：,.!?;:])/u)
    .map((item) => item.trim())
    .filter(Boolean);

  if (chunks.length > 1) return chunks;

  const compact = text.trim();
  if (compact.length <= 12) return [compact];

  const softChunks: string[] = [];
  let cursor = 0;
  while (cursor < compact.length) {
    const next = Math.min(compact.length, cursor + 10);
    softChunks.push(compact.slice(cursor, next));
    cursor = next;
  }
  return softChunks;
}

function buildTimedSubtitles(rawResults: { text: string; startTime: number }[], finalDuration: number): Sub[] {
  const sanitized = rawResults
    .flatMap((item) =>
      splitSubtitlePhrase(item.text).map((text) => ({
        text,
        sourceStart: Math.max(0, item.startTime / 1000),
      })),
    )
    .filter((item) => item.text);

  if (sanitized.length === 0) {
    return [
      {
        id: crypto.randomUUID(),
        text: "（未识别到语音，可稍后手动调整字幕文案）",
        startTime: 0,
        endTime: finalDuration,
      },
    ];
  }

  const totalChars = sanitized.reduce((sum, item) => sum + item.text.length, 0) || sanitized.length;

  return sanitized.map((item, index) => {
    const weight = Math.max(1, item.text.length);
    const weightedDuration = (finalDuration * weight) / totalChars;
    const nextItem = sanitized[index + 1];
    const startTime =
      index === 0
        ? 0
        : Math.max(0, Math.min(finalDuration - 0.2, item.sourceStart));

    let endTime: number;
    if (nextItem) {
      const nextStart = Math.max(startTime + 0.32, nextItem.sourceStart);
      endTime = Math.min(
        finalDuration,
        Math.max(startTime + 0.52, Math.min(nextStart - 0.08, startTime + weightedDuration)),
      );
    } else {
      endTime = finalDuration;
    }

    return {
      id: crypto.randomUUID(),
      text: item.text,
      startTime: Number(startTime.toFixed(2)),
      endTime:
        endTime <= startTime
          ? Number(Math.min(finalDuration, startTime + 0.6).toFixed(2))
          : Number(endTime.toFixed(2)),
    };
  });
}

function buildSubtitlesFromSegments(
  segments: Array<{ text: string; startTime: number; endTime: number }>,
  fallbackDuration: number,
): Sub[] {
  const normalized = segments
    .map((segment) => ({
      text: segment.text.trim(),
      startTime: Math.max(0, segment.startTime),
      endTime: Math.max(segment.startTime, segment.endTime),
    }))
    .filter((segment) => segment.text);

  if (normalized.length === 0) {
    return buildTimedSubtitles([], fallbackDuration);
  }

  return normalized.map((segment, index) => {
    const nextStart = normalized[index + 1]?.startTime;
    const endTime =
      nextStart !== undefined
        ? Math.max(segment.startTime + 0.36, Math.min(segment.endTime, nextStart - 0.06))
        : Math.max(segment.startTime + 0.45, Math.min(fallbackDuration, segment.endTime || fallbackDuration));

    return {
      id: crypto.randomUUID(),
      text: segment.text,
      startTime: Number(segment.startTime.toFixed(2)),
      endTime: Number(Math.max(segment.startTime + 0.3, endTime).toFixed(2)),
    };
  });
}

function buildExportHtml({
  imageBase64,
  exportTitle,
  imageWidth,
  imageHeight,
  playerPosition,
  spotsJson,
}: {
  imageBase64: string;
  exportTitle: string;
  imageWidth: number;
  imageHeight: number;
  playerPosition: { x: number; y: number };
  spotsJson: string;
}) {
  const exportPlayerLeft = Math.min(92, Math.max(8, playerPosition.x));
  const exportPlayerTop = Math.min(92, Math.max(8, playerPosition.y));
  const exportAnchorX =
    exportPlayerLeft >= 78 ? "right" : exportPlayerLeft <= 18 ? "left" : "center";
  const exportVerticalMode = exportPlayerTop >= 78 ? "above" : "below";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
  <meta name="color-scheme" content="dark">
  <title>${exportTitle}</title>
  <style>
    :root{
      color-scheme:dark;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{min-height:100%}
    body{
      font-family:"PingFang SC","Microsoft YaHei",sans-serif;
      background:
        radial-gradient(circle at top,rgba(255,255,255,.06),transparent 18%),
        linear-gradient(180deg,#060606 0%,#090909 100%);
      color:#fff;
    }
    .viewport{
      min-height:100vh;
      padding:clamp(12px,2.8vw,28px);
      display:grid;
      place-items:center;
    }
    .stage-shell{
      width:min(100%,${imageWidth}px);
    }
    .stage{
      --ui-scale:1;
      --subtitle-width:320px;
      position:relative;
      width:100%;
      aspect-ratio:${imageWidth} / ${imageHeight};
    }
    .artwork{
      position:relative;
      width:100%;
      height:100%;
      overflow:hidden;
      border-radius:clamp(18px,2.2vw,30px);
      background:#0d0d0d;
      box-shadow:0 28px 80px rgba(0,0,0,.34);
    }
    .artwork img{
      display:block;
      width:100%;
      height:100%;
      object-fit:fill;
    }
    .shade{
      pointer-events:none;
      position:absolute;
      inset:0;
      background:
        radial-gradient(circle at 50% 20%,rgba(255,255,255,.08),transparent 24%),
        linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,0) 58%,rgba(0,0,0,.14) 78%,rgba(0,0,0,.32) 100%);
    }
    .player{
      position:absolute;
      left:${exportPlayerLeft}%;
      top:${exportPlayerTop}%;
      z-index:3;
      display:flex;
      flex-direction:column;
      gap:calc(var(--ui-scale) * 8px);
    }
    .player[data-anchor="left"]{
      transform:translate(0,-50%);
      align-items:flex-start;
    }
    .player[data-anchor="center"]{
      transform:translate(-50%,-50%);
      align-items:center;
    }
    .player[data-anchor="right"]{
      transform:translate(-100%,-50%);
      align-items:flex-end;
    }
    .subtitle-rail{
      position:relative;
      overflow:hidden;
      max-width:var(--subtitle-width);
      mask-image:linear-gradient(90deg,transparent 0%,black 8%,black 92%,transparent 100%);
      -webkit-mask-image:linear-gradient(90deg,transparent 0%,black 8%,black 92%,transparent 100%);
    }
    .subtitle-rail[data-vertical="above"]{
      order:-1;
      margin-bottom:calc(var(--ui-scale) * 1px);
    }
    .subtitle-rail[data-vertical="below"]{
      margin-top:calc(var(--ui-scale) * 1px);
    }
    .subtitle-rail::before{
      content:"";
      position:absolute;
      inset:-8px 0;
      border-radius:999px;
      background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.18) 14%,rgba(0,0,0,.14) 86%,rgba(0,0,0,0));
      filter:blur(12px);
    }
    .subtitle{
      position:relative;
      width:max-content;
      max-width:none;
      white-space:nowrap;
      font-size:calc(var(--ui-scale) * 14px);
      line-height:1.32;
      color:rgba(255,255,255,.76);
      text-shadow:0 4px 16px rgba(0,0,0,.38);
      transition:transform .18s ease;
    }
    .subtitle span{
      transition:color .18s ease,transform .18s ease,text-shadow .18s ease;
    }
    .controls{
      position:relative;
      display:inline-flex;
      align-items:center;
      gap:calc(var(--ui-scale) * 8px);
      padding:calc(var(--ui-scale) * 7px) calc(var(--ui-scale) * 10px);
      border-radius:999px;
      border:1px solid rgba(255,255,255,.1);
      background:linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.04));
      backdrop-filter:blur(18px);
      -webkit-backdrop-filter:blur(18px);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 10px 22px rgba(0,0,0,.08);
      opacity:.82;
    }
    .controls::before{
      content:"";
      pointer-events:none;
      position:absolute;
      left:-8%;
      top:36%;
      width:116%;
      height:132%;
      border-radius:999px;
      background:radial-gradient(circle,rgba(255,255,255,.14),rgba(255,255,255,.02) 54%,transparent 76%);
      filter:blur(24px);
    }
    .play-button{
      appearance:none;
      border:0;
      width:calc(var(--ui-scale) * 30px);
      height:calc(var(--ui-scale) * 30px);
      border-radius:999px;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.66));
      box-shadow:0 8px 20px rgba(255,255,255,.1);
      color:#090909;
      flex:0 0 auto;
      position:relative;
      z-index:1;
      transition:transform .24s ease;
    }
    .play-button:active{
      transform:scale(.96);
    }
    .play-button:disabled{
      cursor:default;
      opacity:.56;
    }
    .play-icon{
      width:0;
      height:0;
      margin-left:1px;
      border-top:calc(var(--ui-scale) * 4.8px) solid transparent;
      border-bottom:calc(var(--ui-scale) * 4.8px) solid transparent;
      border-left:calc(var(--ui-scale) * 7.6px) solid #090909;
    }
    .pause-icon{
      display:flex;
      gap:3px;
    }
    .pause-icon span{
      display:block;
      width:calc(var(--ui-scale) * 2px);
      height:calc(var(--ui-scale) * 12px);
      border-radius:999px;
      background:#090909;
    }
    .wave{
      position:relative;
      z-index:1;
      display:flex;
      align-items:center;
      gap:calc(var(--ui-scale) * 2.8px);
    }
    .wave span{
      display:block;
      width:calc(var(--ui-scale) * 2.8px);
      border-radius:999px;
      background:rgba(255,255,255,.24);
      transition:background .16s ease,height .16s ease,opacity .16s ease,width .16s ease;
    }
    .time{
      position:relative;
      z-index:1;
      font-size:calc(var(--ui-scale) * 11px);
      line-height:1;
      color:rgba(255,255,255,.72);
      letter-spacing:.01em;
    }
  </style>
</head>
<body>
  <div class="viewport">
    <main class="stage-shell">
      <section id="stage" class="stage">
        <div class="artwork">
          <img src="${imageBase64}" alt="${exportTitle}">
          <div class="shade"></div>
          <div class="player" data-anchor="${exportAnchorX}">
            <div class="subtitle-rail" data-vertical="${exportVerticalMode}">
              <p id="subtitle" class="subtitle">点一下，听听这张作品里留下的话。</p>
            </div>
            <div class="controls">
              <button id="play-button" class="play-button" type="button" aria-label="播放作品">
                <span class="play-icon"></span>
              </button>
              <div id="wave" class="wave" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span id="time" class="time">0:00</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>

  <script>
    const spots = ${spotsJson};
    const currentSpot = spots.find((spot) => spot.audio) || null;
    const audio = currentSpot && currentSpot.audio ? new Audio(currentSpot.audio.url) : null;
    const stage = document.getElementById("stage");
    const playButton = document.getElementById("play-button");
    const subtitleEl = document.getElementById("subtitle");
    const timeEl = document.getElementById("time");
    const waveBars = Array.from(document.querySelectorAll("#wave span"));
    const waveformPattern = [0.4,0.7,0.54,0.86,0.46,0.34,0.6,0.48,0.78,0.92,0.64,0.42,0.56,0.36,0.28,0.5];
    let currentTime = 0;
    let playing = false;
    let uiScale = 1;
    let compact = false;

    function fmt(value){
      const seconds = Math.max(0, Math.floor(value));
      return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
    }

    function updateResponsiveUi(){
      if(!stage) return;
      const width = stage.clientWidth || ${imageWidth};
      uiScale = Math.min(1.08, Math.max(0.76, width / 1080));
      compact = width < 640;
      stage.style.setProperty("--ui-scale", uiScale.toFixed(4));
      stage.style.setProperty("--subtitle-width", Math.min(width * (compact ? 0.46 : 0.34), (compact ? 248 : 360) * uiScale) + "px");
      if(timeEl){
        timeEl.style.display = width >= 1100 ? "inline" : "none";
      }
    }

    function setButtonState(){
      if(!playButton) return;
      if(!audio){
        playButton.disabled = true;
        return;
      }
      playButton.disabled = false;
      playButton.innerHTML = playing
        ? '<span class="pause-icon"><span></span><span></span></span>'
        : '<span class="play-icon"></span>';
    }

    function renderWave(){
      const visibleBars = compact ? 10 : waveformPattern.length;
      waveBars.forEach((bar,index) => {
        if(index >= visibleBars){
          bar.style.display = "none";
          return;
        }
        bar.style.display = "block";
        const threshold = visibleBars <= 1 ? 0 : index / (visibleBars - 1);
        const active = currentSpot && currentSpot.audio ? currentTime / currentSpot.audio.dur >= threshold : false;
        const pulse = playing ? 0.1 * Math.sin(currentTime * 4.2 + index * 0.7) : 0;
        const height = Math.max(4, (4 + waveformPattern[index] * (compact ? 11 : 14) + pulse * 5) * uiScale);
        const width = Math.max(2, (compact ? 2.2 : 2.8) * uiScale);
        bar.style.width = width + "px";
        bar.style.height = height + "px";
        bar.style.background = active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.26)";
      });
    }

    function renderSubtitle(){
      if(!subtitleEl) return;
      subtitleEl.textContent = "";
      if(!currentSpot || !currentSpot.audio){
        subtitleEl.textContent = "暂无录音。";
        subtitleEl.style.transform = "translateX(0)";
        return;
      }
      const currentSubtitle = currentSpot.audio.subs.find((item) => currentTime >= item.startTime && currentTime < item.endTime);
      if(!currentSubtitle){
        subtitleEl.textContent = playing ? "" : "点一下，听听这张作品里留下的话。";
        subtitleEl.style.transform = "translateX(0)";
        return;
      }

      const totalChars = currentSubtitle.text.length || 1;
      const subtitleProgress = currentSubtitle.endTime > currentSubtitle.startTime
        ? Math.min(1, Math.max(0, (currentTime - currentSubtitle.startTime) / (currentSubtitle.endTime - currentSubtitle.startTime)))
        : 0;
      const shift = currentSubtitle.text.length > 12
        ? Math.max(0, currentSubtitle.text.length - 12) * subtitleProgress * 0.22
        : 0;
      subtitleEl.style.transform = "translateX(-" + shift + "em)";

      currentSubtitle.text.split("").forEach((char,index) => {
        const durationPerChar = (currentSubtitle.endTime - currentSubtitle.startTime) / totalChars;
        const charStart = currentSubtitle.startTime + index * durationPerChar;
        const charEnd = charStart + durationPerChar;
        const isCurrent = currentTime >= charStart && currentTime < charEnd;
        const hasPassed = currentTime >= charEnd;
        const span = document.createElement("span");
        span.textContent = char;
        span.style.color = isCurrent
          ? "rgba(255,255,255,1)"
          : hasPassed
            ? "rgba(255,255,255,0.74)"
            : "rgba(255,255,255,0.3)";
        span.style.textShadow = isCurrent
          ? "0 0 10px rgba(255,255,255,0.16), 0 4px 16px rgba(0,0,0,0.38)"
          : "0 4px 16px rgba(0,0,0,0.38)";
        span.style.transform = isCurrent ? "translateY(-0.4px)" : "translateY(0)";
        subtitleEl.appendChild(span);
      });
    }

    function render(){
      updateResponsiveUi();
      if(timeEl){
        timeEl.textContent = fmt(currentTime);
      }
      setButtonState();
      renderWave();
      renderSubtitle();
    }

    if(audio){
      audio.addEventListener("timeupdate", () => {
        currentTime = audio.currentTime;
        render();
      });
      audio.addEventListener("play", () => {
        playing = true;
        render();
      });
      audio.addEventListener("pause", () => {
        playing = false;
        render();
      });
      audio.addEventListener("ended", () => {
        playing = false;
        currentTime = currentSpot ? currentSpot.audio.dur : 0;
        render();
      });
    }

    playButton && playButton.addEventListener("click", async () => {
      if(!audio) return;
      if(audio.ended || audio.currentTime >= Math.max(0, audio.duration - 0.08)){
        audio.currentTime = 0;
        currentTime = 0;
      }
      if(playing){
        audio.pause();
        return;
      }
      try{
        await audio.play();
      }catch{}
    });

    if("ResizeObserver" in window && stage){
      const observer = new ResizeObserver(() => render());
      observer.observe(stage);
    } else {
      window.addEventListener("resize", render);
    }

    render();
  </script>
</body>
</html>`;
}

export function EditorClient({ project }: { project: Proj }) {
  const parsedSettings: ProjectSettings = (() => {
    if (!project.settings) return {};
    try {
      return JSON.parse(project.settings) as ProjectSettings;
    } catch {
      return {};
    }
  })();
  const router = useRouter();
  const normalizedInitialTitle = (() => {
    const trimmed = project.title.trim();
    if (!trimmed || trimmed === "新的作品") return "未命名作品";
    return trimmed;
  })();
  const [title, setTitle] = useState(normalizedInitialTitle);
  const [imageUrl, setImageUrl] = useState<string | null>(project.coverImage);
  const [spots, setSpots] = useState<Spot[]>(project.hotspots);
  const [selectedId, setSelectedId] = useState<string | null>(project.hotspots[0]?.id ?? null);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [liveSubs, setLiveSubs] = useState<Sub[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [previewTime, setPreviewTime] = useState(0);
  const [playerPosition, setPlayerPosition] = useState<{ x: number; y: number }>(
    parsedSettings.playerPosition ?? { x: 10, y: 84 },
  );
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(
    parsedSettings.imageSize ?? null,
  );
  const [positionMode, setPositionMode] = useState(false);
  const [addSpotMode, setAddSpotMode] = useState(false);
  const [isDraggingPlayer, setIsDraggingPlayer] = useState(false);
  const [draggingSpotId, setDraggingSpotId] = useState<string | null>(null);
  const [speechSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    const win = window as Window & typeof globalThis & {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  });

  const artworkFrameRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechStartRef = useRef(0);
  const speechResultsRef = useRef<{ text: string; startTime: number }[]>([]);
  const draggingPlayerRef = useRef(false);
  const spotDragMovedRef = useRef(false);

  const selectedSpot = spots.find((spot) => spot.id === selectedId) ?? null;
  const primarySpot = spots[0] ?? null;
  const playableSpots = spots.filter((spot) => spot.audio);
  const recordedCount = spots.filter((spot) => spot.audio).length;
  const shareUrl = buildShareUrl(project.id);
  const shareIsLocal = isLocalShareUrl(shareUrl);
  const canPreview = Boolean(imageUrl && recordedCount > 0);
  const previewSpot =
    (playingId ? spots.find((spot) => spot.id === playingId) : null) ??
    playableSpots[0] ??
    selectedSpot ??
    null;
  const previewHasAudio = Boolean(previewSpot?.audio);
  const previewSubtitle = previewSpot?.audio?.subtitles.find(
    (subtitle) => previewTime >= subtitle.startTime && previewTime < subtitle.endTime,
  );
  const previewCompactArtwork = (imageSize?.width ?? 0) > 0 ? (imageSize?.width ?? 0) < 720 : false;
  const previewAnchorX = playerPosition.x >= 78 ? "right" : playerPosition.x <= 18 ? "left" : "center";
  const previewVerticalMode = playerPosition.y >= 78 ? "above" : "below";
  const previewTranslateX =
    previewAnchorX === "right" ? "-100%" : previewAnchorX === "center" ? "-50%" : "0%";
  const previewAlignItems =
    previewAnchorX === "right" ? "flex-end" : previewAnchorX === "center" ? "center" : "flex-start";
  const hasImage = Boolean(imageUrl);
  const playerReady = Boolean(parsedSettings.playerPosition);
  const heroEyebrow = hasImage ? "作品已放入" : "开始制作";
  const heroTitle = hasImage ? "把想说的话，留在作品上" : "先放作品图，再留下你的声音";
  const heroBody = hasImage
    ? "播放键和字幕会跟着这张图一起成型。"
    : "一张图，一段录音，一条字幕，最后会变成一张能分享的作品卡。";
  const stagePills = [
    { label: "图片", value: hasImage ? "已放入" : "等待中" },
    { label: "录音", value: recordingProgressLabel(recordedCount, spots.length) },
    { label: "播放位", value: playerReady ? "已定位" : "待定位" },
  ];

  function triggerImagePicker() {
    fileInputRef.current?.click();
  }

  function createCue(next: { x: number; y: number; title: string }) {
    const cue: Spot = {
      id: crypto.randomUUID(),
      x: next.x,
      y: next.y,
      color: COLORS[spots.length % COLORS.length],
      title: next.title,
      audio: null,
    };

    setSpots((prev) => [...prev, cue]);
    setSelectedId(cue.id);
    return cue;
  }

  function createPrimaryCue() {
    if (!imageUrl || spots.length > 0) return;
    createCue({ x: 50, y: 50, title: "录音 1" });
  }

  function getPositionFromClientPoint(clientX: number, clientY: number) {
    if (!artworkFrameRef.current) return null;
    const bounds = artworkFrameRef.current.getBoundingClientRect();
    const x = Math.min(92, Math.max(8, Math.round((((clientX - bounds.left) / bounds.width) * 10000)) / 100));
    const y = Math.min(92, Math.max(8, Math.round((((clientY - bounds.top) / bounds.height) * 10000)) / 100));
    return { x, y };
  }

  function updatePlayerPosition(event: React.MouseEvent<HTMLDivElement>) {
    if (!positionMode) return;
    const nextPosition = getPositionFromClientPoint(event.clientX, event.clientY);
    if (!nextPosition) return;
    setPlayerPosition(nextPosition);
  }

  function handlePlayerDragStart(event: React.PointerEvent<HTMLDivElement>) {
    if (!positionMode) return;
    event.preventDefault();
    event.stopPropagation();
    draggingPlayerRef.current = true;
    setIsDraggingPlayer(true);
    artworkFrameRef.current?.setPointerCapture(event.pointerId);
    const nextPosition = getPositionFromClientPoint(event.clientX, event.clientY);
    if (nextPosition) {
      setPlayerPosition(nextPosition);
    }
  }

  function handleArtworkPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingPlayerRef.current) return;
    event.preventDefault();
    const nextPosition = getPositionFromClientPoint(event.clientX, event.clientY);
    if (nextPosition) {
      setPlayerPosition(nextPosition);
    }
  }

  function handleArtworkPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (artworkFrameRef.current?.hasPointerCapture(event.pointerId)) {
      artworkFrameRef.current.releasePointerCapture(event.pointerId);
    }
    stopPlayerDragging();
  }

  function stopPlayerDragging() {
    if (!draggingPlayerRef.current) return;
    draggingPlayerRef.current = false;
    setIsDraggingPlayer(false);
    setPositionMode(false);
  }

  function handlePositionModeToggle() {
    draggingPlayerRef.current = false;
    setIsDraggingPlayer(false);
    setPositionMode((value) => !value);
  }

  function handleRecordStep() {
    if (!imageUrl) {
      triggerImagePicker();
      return;
    }
    if (!selectedId && spots[0]) {
      setSelectedId(spots[0].id);
    }
    if (!primarySpot && spots.length === 0) {
      createPrimaryCue();
    }
    setTimeout(() => {
      document.getElementById("record-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  async function handlePreviewStep() {
    if (!canPreview) return;
    await persistCurrentProjectState();
    window.open(`/play/${project.id}?from=editor`, "_blank");
  }

  async function handleShareStep() {
    if (!canPreview) return;
    await persistCurrentProjectState();
    void openShare();
  }

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  async function patchProject(data: Record<string, unknown>) {
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  function serializeHotspots(nextSpots: Spot[]) {
    return nextSpots.map((spot) => ({
      id: spot.id,
      x: spot.x,
      y: spot.y,
      color: spot.color,
      title: spot.title,
      audio: spot.audio
        ? {
            id: spot.audio.id,
            audioUrl: spot.audio.audioUrl,
            duration: spot.audio.duration,
            subtitles: spot.audio.subtitles.map((subtitle) => ({
              id: subtitle.id,
              text: subtitle.text,
              startTime: subtitle.startTime,
              endTime: subtitle.endTime,
            })),
          }
        : null,
    }));
  }

  async function persistProjectState(nextSpots: Spot[], nextTitle = title, nextImageUrl = imageUrl) {
    await patchProject({
      title: nextTitle,
      coverImage: nextImageUrl,
      settings: JSON.stringify({
        ...parsedSettings,
        playerPosition,
        imageSize,
      }),
      hotspots: serializeHotspots(nextSpots),
    });
  }

  async function persistCurrentProjectState() {
    await persistProjectState(spots);
  }

  async function uploadFile(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const nextImageSize = await getImageSize(file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!response.ok) throw new Error("upload failed");
      const { url } = await response.json();
      setImageUrl(url);
      setImageSize(nextImageSize);
      if (spots.length === 0) {
        const cue = {
          id: crypto.randomUUID(),
          x: 50,
          y: 50,
          color: COLORS[0],
          title: "录音 1",
          audio: null,
        };
        setSpots([cue]);
        setSelectedId(cue.id);
      }
      await patchProject({
        coverImage: url,
        settings: JSON.stringify({
          ...parsedSettings,
          playerPosition,
          imageSize: nextImageSize,
        }),
      });
      toast.success("图片已更新");
    } catch {
      toast.error("上传失败");
    } finally {
      setUploading(false);
    }
  }

  function addSpot(event: React.MouseEvent) {
    if (positionMode) return;
    if (recording) { toast.error("请先停止录音"); return; }
    if (!imageUrl) { toast.error("请先上传图片"); return; }
    if (!artworkFrameRef.current) return;
    const bounds = artworkFrameRef.current.getBoundingClientRect();
    createCue({
      x: Math.round((((event.clientX - bounds.left) / bounds.width) * 10000)) / 100,
      y: Math.round((((event.clientY - bounds.top) / bounds.height) * 10000)) / 100,
      title: `录音 ${spots.length + 1}`,
    });
    setAddSpotMode(false);
    toast.success(`已添加录音 ${spots.length + 1}`);
  }

  function deleteSpot(id: string) {
    const nextSpots = spots.filter((spot) => spot.id !== id);
    setSpots(nextSpots);
    if (selectedId === id) setSelectedId(nextSpots[0]?.id ?? null);
    if (playingId === id) setPlayingId(null);
  }

  async function startRecording() {
    try {
      const speechWindow = window as Window &
        typeof globalThis & {
          SpeechRecognition?: BrowserSpeechRecognitionConstructor;
          webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
        };
      const SpeechRecognition =
        speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = "zh-CN";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
          let interimText = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = (event.results[i]?.[0]?.transcript ?? "").trim();
            if (!text) continue;
            if (event.results[i].isFinal) {
              const elapsed = Date.now() - speechStartRef.current;
              speechResultsRef.current.push({ text, startTime: elapsed });
              setLiveSubs((prev) => [
                ...prev,
                { id: crypto.randomUUID(), text, startTime: elapsed / 1000 - 0.5, endTime: elapsed / 1000 + 1 },
              ]);
            } else {
              interimText += text;
            }
          }
          if (interimText) {
            setLiveSubs((prev) => {
              const filtered = prev.filter((s) => !s.id.startsWith("interim-"));
              return [...filtered, { id: `interim-${Date.now()}`, text: interimText, startTime: 0, endTime: 999 }];
            });
          }
        };

        recognition.onerror = (event: Event & { error?: string }) => {
          if (event.error === "not-allowed") toast.error("语音识别需要麦克风权限");
        };

        try { recognition.start(); recognitionRef.current = recognition; } catch {}
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Try codecs in order of preference (Safari only supports audio/mp4)
      const codecs = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
      let recorder: MediaRecorder | null = null;
      let selectedMime = "";
      for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(codec)) {
          recorder = new MediaRecorder(stream, { mimeType: codec });
          selectedMime = codec;
          break;
        }
      }
      if (!recorder) {
        recorder = new MediaRecorder(stream); // fallback: let browser decide
      }

      chunksRef.current = [];
      const blobType = selectedMime.startsWith("audio/mp4") ? "audio/mp4" : "audio/webm";
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        try {
          recognitionRef.current?.stop();
        } catch {}
        setRecordedBlob(new Blob(chunksRef.current, { type: blobType }));
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      speechStartRef.current = Date.now();
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((value) => value + 0.1), 100);
    } catch (err) {
      const msg = err instanceof DOMException
        ? (err.name === "NotAllowedError" ? "请允许麦克风权限" : `录音失败: ${err.message}`)
        : "录音启动失败";
      toast.error(msg);
    }
  }

  function stopRecording() {
    try {
      recognitionRef.current?.stop();
    } catch {}
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function saveRecording() {
    if (!recordedBlob || !selectedId) return;

    const savingId = toast.loading("正在保存录音…");
    try {
      const formData = new FormData();
      const ext = recordedBlob.type === "audio/mp4" ? "m4a" : "webm";
      formData.append("file", recordedBlob, `recording.${ext}`);
      formData.append("duration", String(Number(recordingTime.toFixed(2))));
      const response = await fetch("/api/upload?type=audio", { method: "POST", body: formData });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        toast.dismiss(savingId);
        toast.error(`上传失败: ${response.status} ${errText}`);
        return;
      }

      const { url, duration } = await response.json();
      const finalDuration = duration || recordingTime;
      const rawResults = speechResultsRef.current;
      let subtitles = buildTimedSubtitles(rawResults, finalDuration);

      try {
        const transcribeResponse = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioUrl: url, duration: finalDuration }),
        });
        if (transcribeResponse.ok) {
          const transcribeData = (await transcribeResponse.json()) as {
            text?: string;
            segments?: Array<{ text: string; startTime: number; endTime: number }>;
          };
          if (transcribeData.segments?.length) {
            subtitles = buildSubtitlesFromSegments(transcribeData.segments, finalDuration);
          }
        }
      } catch {}

      const audioData: AudioData = {
        id: crypto.randomUUID(),
        audioUrl: url,
        duration: finalDuration,
        subtitles,
      };

      const nextSpots = spots.map((spot) => (spot.id === selectedId ? { ...spot, audio: audioData } : spot));
      setSpots(nextSpots);

      try {
        await persistProjectState(nextSpots);
      } catch {
        toast.dismiss(savingId);
        toast.error("项目更新失败，请重试");
        return;
      }

      setRecordedBlob(null);
      setLiveSubs([]);
      toast.dismiss(savingId);

      if (recordedCount === 0 && !parsedSettings.playerPosition) {
        setPositionMode(true);
        toast.success("录音已保存！请在作品上点击放下播放键的位置。", { duration: 5000 });
      } else {
        toast.success(`录音已保存${subtitles.length > 0 ? `，识别出 ${subtitles.length} 句字幕` : ""}`);
      }
    } catch (err) {
      toast.dismiss(savingId);
      toast.error(`保存失败: ${err instanceof Error ? err.message : "网络错误"}`);
    }
  }

  function togglePreviewAudio(spot: Spot) {
    if (!spot.audio) return;

    if (playingId === spot.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(spot.audio.audioUrl);
    audio.ontimeupdate = () => setPreviewTime(audio.currentTime);
    audio.onended = () => {
      setPlayingId(null);
      setPreviewTime(spot.audio?.duration ?? audio.currentTime);
    };
    audio.onpause = () => {
      if (!audio.ended) {
        setPreviewTime(audio.currentTime);
      }
    };
    audio.currentTime = 0;
    setPreviewTime(0);
    void audio.play();
    audioRef.current = audio;
    setPlayingId(spot.id);
  }

  async function saveProject() {
    setSaving(true);
    await persistProjectState(spots);
    setSaving(false);
    toast.success("作品已保存");
    router.refresh();
  }

  async function openShare() {
    if (shareIsLocal) {
      toast.error("当前还是本机预览地址，更适合先导出 HTML，或部署后再发链接。");
    }
    try {
      if (shareIsLocal) {
        setQrDataUrl("");
      } else {
        setQrDataUrl(
          await QRCode.toDataURL(shareUrl, {
            width: 220,
            margin: 1,
            color: { dark: "#181816", light: "#ffffff" },
          }),
        );
      }
    } catch {}
    setShowShare(true);
  }

  function handleSpotDragStart(spotId: string, event: React.PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    spotDragMovedRef.current = false;
    setDraggingSpotId(spotId);
    artworkFrameRef.current?.setPointerCapture(event.pointerId);
  }

  function handleSpotDragMove(event: React.PointerEvent) {
    if (!draggingSpotId || !artworkFrameRef.current) return;
    const pos = getPositionFromClientPoint(event.clientX, event.clientY);
    if (!pos) return;
    spotDragMovedRef.current = true;
    setSpots((prev) =>
      prev.map((s) => (s.id === draggingSpotId ? { ...s, x: pos.x, y: pos.y } : s))
    );
  }

  function handleSpotDragEnd(event: React.PointerEvent) {
    if (artworkFrameRef.current?.hasPointerCapture(event.pointerId)) {
      artworkFrameRef.current.releasePointerCapture(event.pointerId);
    }
    setDraggingSpotId(null);
  }

  async function downloadHtml() {
    const loadingId = toast.loading("正在生成作品文件…");

    try {
      const imageBase64 = imageUrl ? await toBase64(imageUrl) : "";
      const exportTitle = escapeHtml(title || "图述");
      const exportName = (title || "图述").trim() || "图述";
      const exportImageWidth = Math.max(1, Math.round(imageSize?.width ?? 1600));
      const exportImageHeight = Math.max(1, Math.round(imageSize?.height ?? 900));
      const audioMap: Record<string, string> = {};

      for (const spot of spots) {
        if (spot.audio?.audioUrl && !audioMap[spot.audio.audioUrl]) {
          audioMap[spot.audio.audioUrl] = await toBase64(spot.audio.audioUrl);
        }
      }

      const spotsJson = JSON.stringify(
        spots.map((spot) => ({
          x: spot.x,
          y: spot.y,
          color: spot.color,
          title: spot.title,
          audio: spot.audio
            ? {
                dur: spot.audio.duration,
                url: audioMap[spot.audio.audioUrl],
                subs: spot.audio.subtitles,
          }
            : null,
        })),
      );

      const html = buildExportHtml({
        imageBase64,
        exportTitle,
        imageWidth: exportImageWidth,
        imageHeight: exportImageHeight,
        playerPosition,
        spotsJson,
      });

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${exportName}.html`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.dismiss(loadingId);
      toast.success("HTML 作品卡已下载");
    } catch {
      toast.dismiss(loadingId);
      toast.error("下载失败");
    }
  }

  const stepCards = [
    {
      key: "image",
      label: "01",
      title: "图片",
      desc: imageUrl ? "画面已就位" : "先放入作品",
      action: imageUrl ? "换图" : "选图",
      disabled: false,
    },
    {
      key: "record",
      label: "02",
      title: "录音",
      desc: recordedCount > 0 ? "声音已留下" : "录下这段话",
      action: selectedSpot?.audio ? "重新录音" : "开始录音",
      disabled: false,
    },
    {
      key: "preview",
      label: "03",
      title: "预览",
      desc: canPreview ? "看成品状态" : "录完再看",
      action: canPreview ? "打开预览" : "等待录音",
      disabled: !canPreview,
    },
    {
      key: "share",
      label: "04",
      title: "分享",
      desc: canPreview ? "发给朋友或客户" : "完成后分享",
      action: canPreview ? "打开分享" : "等待完成",
      disabled: !canPreview,
    },
  ] as const;

  return (
    <>
      <div className="site-shell site-grid min-h-screen px-4 py-5 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        <header className="sticky top-0 z-40 mb-5 border-b border-white/8 bg-black/72 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1540px] flex-wrap items-center justify-between gap-4 px-0 py-4 sm:px-0">
            <div className="min-w-0">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-xs tracking-[0.16em] text-white/42 uppercase transition-opacity hover:opacity-75"
              >
                返回
              </button>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="display-title min-w-[180px] bg-transparent text-[1.95rem] leading-none text-white outline-none sm:min-w-[240px] sm:text-[2.8rem] lg:text-[3.1rem]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={handlePreviewStep} className="ghost-button ghost-button-dark rounded-full px-4 py-2 text-sm font-medium">预览</button>
              <button onClick={handleShareStep} className="hidden rounded-full px-4 py-2 text-sm font-medium ghost-button ghost-button-dark sm:inline-flex">分享</button>
              <button
                onClick={saveProject}
                disabled={saving}
                className="accent-button rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-55"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-[1540px] gap-6 lg:grid-cols-[minmax(0,1.08fr)_390px]">
          <section className="space-y-6">
            <section className="gallery-stage overflow-hidden rounded-[2.2rem] border border-white/10">
              <div className="gallery-stage-backdrop">
                <div className="h-full w-full bg-[linear-gradient(180deg,#111111_0%,#070707_100%)]" />
              </div>

              <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_30%,rgba(255,255,255,0.07),transparent_24%),radial-gradient(circle_at_18%_82%,rgba(255,255,255,0.04),transparent_18%)]" />
              <div className="gallery-stage-overlay !bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0)_16%,rgba(8,8,8,0)_58%,rgba(8,8,8,0.3)_100%)]" />

              <div className="relative z-10 px-5 py-6 sm:px-8 sm:py-8">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="eyebrow text-white/36">{heroEyebrow}</p>
                    <h1 className={`display-title mt-4 max-w-[8.5em] leading-[0.9] text-white ${
                      hasImage ? "text-[1.72rem] sm:text-[2.15rem] lg:text-[2.35rem]" : "text-[2.05rem] sm:text-[3rem] lg:text-[3.3rem]"
                    }`}>
                      {heroTitle}
                    </h1>
                    <p className="mt-3 max-w-[22rem] text-[13px] leading-6 text-white/50 sm:mt-4 sm:max-w-[24rem] sm:text-[14px] sm:leading-6">
                      {heroBody}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {stagePills.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] tracking-[0.14em] text-white/52 uppercase"
                        >
                          <span className="text-white/28">{item.label}</span>
                          <span className="ml-2 text-white/72">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="hidden flex-wrap gap-2 lg:flex">
                    <button onClick={triggerImagePicker} className="ghost-button ghost-button-dark rounded-full px-4 py-2 text-sm font-medium">
                      {uploading ? "上传中…" : imageUrl ? "换图" : "选图"}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadFile(file);
                      }}
                    />
                    <button
                      onClick={() => { setAddSpotMode(!addSpotMode); if (positionMode) setPositionMode(false); }}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${addSpotMode ? "accent-button" : "ghost-button ghost-button-dark"}`}
                    >
                      {addSpotMode ? "点击图上放置" : "添加录音"}
                    </button>
                    <button onClick={handleShareStep} className="ghost-button ghost-button-dark rounded-full px-4 py-2 text-sm font-medium">分享</button>
                  </div>
                </div>

                {imageUrl ? (
                  <div
                    className={`relative overflow-hidden rounded-[1.65rem] border border-white/10 ${
                      hasImage
                        ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] px-2 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.16)]"
                        : "bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-3 py-3 shadow-[0_30px_70px_rgba(0,0,0,0.18)]"
                    } backdrop-blur-md sm:rounded-[2rem] sm:px-4 sm:py-4 cursor-crosshair`}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.1),transparent_18%)]" />
                    <div className="relative flex min-h-[46vh] items-center justify-center sm:min-h-[64vh] lg:min-h-[72vh]">
                      <div
                        ref={artworkFrameRef}
                        onClick={addSpotMode ? addSpot : undefined}
                        onPointerMove={(e) => { handleArtworkPointerMove(e); handleSpotDragMove(e); }}
                        onPointerUp={(e) => { handleArtworkPointerUp(e); handleSpotDragEnd(e); }}
                        onPointerCancel={(e) => { handleArtworkPointerUp(e); handleSpotDragEnd(e); }}
                        className={`relative z-10 overflow-hidden rounded-[1.35rem] border border-white/8 bg-black/12 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:rounded-[1.8rem] ${
                          positionMode ? "cursor-crosshair" : "cursor-crosshair"
                        }`}
                      >
                        <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex justify-between gap-3 sm:inset-x-5 sm:top-5">
                          <div className="flex flex-col gap-1.5">
                            <div className="max-w-[18rem] rounded-full border border-white/10 bg-black/24 px-3 py-2 text-[11px] tracking-[0.14em] text-white/56 uppercase backdrop-blur-xl">
                              {addSpotMode
                                ? "点击图上任意位置添加录音"
                                : recordedCount > 0
                                  ? "拖动播放键调整位置，点播放试听"
                                  : "点击「添加录音」在图上放置录音点" }
                            </div>
                            {spots.length > 1 && (
                              <div className="max-w-[16rem] rounded-full border border-white/10 bg-black/24 px-3 py-2 text-[10px] tracking-[0.14em] text-white/40 uppercase backdrop-blur-xl">
                                按住播放键可拖动位置
                              </div>
                            )}
                          </div>
                          {spots.length > 1 && (
                            <div className="rounded-full border border-white/10 bg-black/24 px-3 py-2 text-[11px] tracking-[0.14em] text-white/56 uppercase backdrop-blur-xl">
                              录音段 · {String(spots.length).padStart(2, "0")}
                            </div>
                          )}
                        </div>
                        <div style={{ pointerEvents: "none", userSelect: "none" }} className="contents">
                          <Image
                            src={imageUrl}
                            alt={title}
                            draggable={false}
                            width={imageSize?.width ?? 1800}
                            height={imageSize?.height ?? 1400}
                            sizes="(min-width: 1280px) 72vw, (min-width: 1024px) 66vw, 100vw"
                            className="block max-h-[76vh] max-w-full object-contain"
                          />
                        </div>

                        {/* Multi-spot players: each spot with audio gets its own play button + subtitle */}
                        {spots.filter(s => s.audio).map((spot) => {
                          const isPlayingThis = playingId === spot.id;
                          const currentSub = spot.audio?.subtitles.find(
                            s => previewTime >= s.startTime && previewTime < s.endTime
                          );
                          const anchorX = spot.x >= 78 ? "right" : spot.x <= 18 ? "left" : "center";
                          const verticalMode = spot.y >= 78 ? "above" : "below";
                          const tx = anchorX === "right" ? "-100%" : anchorX === "center" ? "-50%" : "0%";
                          const ai = anchorX === "right" ? "flex-end" : anchorX === "center" ? "center" : "flex-start";
                          return (
                            <div
                              key={spot.id}
                              className="absolute z-30 cursor-grab active:cursor-grabbing"
                              style={{
                                left: `${spot.x}%`,
                                top: `${spot.y}%`,
                                transform: `translate(${tx}, -50%)`,
                              }}
                              onPointerDown={(e) => { e.stopPropagation(); handleSpotDragStart(spot.id, e); }}
                            >
                              <div className="flex flex-col max-w-[min(42vw,280px)] sm:max-w-[min(34vw,320px)]" style={{ alignItems: ai }}>
                                {verticalMode === "above" && currentSub && (
                                  <div className="pointer-events-none relative mb-1 overflow-hidden">
                                    <div className="rounded-full bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,0.18)_14%,rgba(0,0,0,0.14)_86%,rgba(0,0,0,0))] px-1 py-0.5 backdrop-blur-sm">
                                      <p className="whitespace-nowrap px-1.5 text-[10px] leading-[1.35] text-white/80">{currentSub.text}</p>
                                    </div>
                                  </div>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); if (spotDragMovedRef.current) return; setSelectedId(spot.id); togglePreviewAudio(spot); }}
                                  className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))] px-2 py-1.5 backdrop-blur-xl shadow-[0_6px_16px_rgba(0,0,0,0.12)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0.08))] transition-all"
                                >
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: spot.color }}>
                                    {isPlayingThis ? "⏸" : "▶"}
                                  </span>
                                  <span className="text-[10px] text-white/70">{spot.title}</span>
                                </button>
                                {verticalMode === "below" && currentSub && (
                                  <div className="pointer-events-none relative mt-1 overflow-hidden">
                                    <div className="rounded-full bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,0.18)_14%,rgba(0,0,0,0.14)_86%,rgba(0,0,0,0))] px-1 py-0.5 backdrop-blur-sm">
                                      <p className="whitespace-nowrap px-1.5 text-[10px] leading-[1.35] text-white/80">{currentSub.text}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {/* Position mode drag target */}
                        {positionMode && (
                          <div
                            onPointerDown={handlePlayerDragStart}
                            className="absolute z-30 cursor-grab active:cursor-grabbing"
                            style={{
                              left: `${playerPosition.x}%`,
                              top: `${playerPosition.y}%`,
                              transform: `translate(${previewTranslateX}, -50%)`,
                            }}
                          >
                            <div className="flex flex-col" style={{ alignItems: previewAlignItems }}>
                              {previewVerticalMode === "above" && (
                                <div className="pointer-events-none relative mb-1.5 overflow-hidden">
                                  <div className="rounded-full bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,0.18)_14%,rgba(0,0,0,0.14)_86%,rgba(0,0,0,0))] px-1 py-1 backdrop-blur-sm">
                                    <p className="artwork-subtitle-pill whitespace-nowrap px-2 text-[10px] leading-[1.35] text-white/74">拖到你想放的位置</p>
                                  </div>
                                </div>
                              )}
                              <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.035))] px-2 py-1.5 backdrop-blur-[18px]">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/30 text-xs">📍</span>
                              </div>
                              {previewVerticalMode === "below" && (
                                <div className="pointer-events-none relative mt-1.5 overflow-hidden">
                                  <div className="rounded-full bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,0.18)_14%,rgba(0,0,0,0.14)_86%,rgba(0,0,0,0))] px-1 py-1 backdrop-blur-sm">
                                    <p className="artwork-subtitle-pill whitespace-nowrap px-2 text-[10px] leading-[1.35] text-white/74">拖到你想放的位置</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {positionMode && (
                          <div
                            className="pointer-events-none absolute z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-white/45 bg-white/8"
                            style={{
                              left: `${playerPosition.x}%`,
                              top: `${playerPosition.y}%`,
                            }}
                          >
                            <span className="h-2 w-2 rounded-full bg-white/85" />
                          </div>
                        )}
                      </div>

                      {spots.map((spot, index) => {
                        const isSelected = selectedId === spot.id;
                        return (
                          <button
                            key={spot.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(spot.id);
                            }}
                            className={`hotspot-marker hotspot-core absolute z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 ${
                              isSelected ? "active" : ""
                            } ${showAdvanced || index === 0 ? "opacity-100" : "pointer-events-none opacity-0"}`}
                            style={{
                              left: `${spot.x}%`,
                              top: `${spot.y}%`,
                              background: "rgba(255,255,255,0.74)",
                              boxShadow: isSelected
                                ? "0 0 0 8px rgba(24,24,22,0.06), 0 18px 40px rgba(0,0,0,0.1)"
                                : "0 8px 24px rgba(0,0,0,0.08)",
                            }}
                            title={spot.title}
                          >
                            <span
                              className="flex h-6.5 w-6.5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                              style={{ background: spot.color }}
                            >
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <label className="flex min-h-[56vh] cursor-pointer flex-col items-center justify-center rounded-[1.65rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-6 text-center backdrop-blur-md sm:min-h-[72vh] sm:rounded-[2rem] sm:px-8">
                    <span className="display-title text-[2.8rem] leading-[0.86] text-white/26 sm:text-[4.8rem]">
                      放入一张
                      <br />
                      作品图
                    </span>
                    <span className="ghost-button ghost-button-dark mt-6 rounded-full px-6 py-3 text-sm font-medium sm:mt-8">{uploading ? "上传中…" : "选择图片"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadFile(file);
                      }}
                    />
                  </label>
                )}
              </div>
            </section>

            <section className="space-y-4 lg:hidden">
              <section className="premium-shell rounded-[1.6rem] p-4 sm:rounded-[2rem]">
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={triggerImagePicker} className="ghost-button ghost-button-dark rounded-full px-4 py-3 text-sm font-medium">
                    {uploading ? "上传中…" : imageUrl ? "换图" : "选图"}
                  </button>


                  <button
                    onClick={() => { setAddSpotMode(!addSpotMode); if (positionMode) setPositionMode(false); }}
                    className={`rounded-full px-4 py-3 text-sm font-medium ${addSpotMode ? "accent-button" : "ghost-button ghost-button-dark"}`}
                  >
                    {addSpotMode ? "放置中" : "添加录音"}
                  </button>
                  <button onClick={handleShareStep} className="ghost-button ghost-button-dark rounded-full px-4 py-3 text-sm font-medium">
                    分享
                  </button>
                </div>
                <button onClick={handlePreviewStep} disabled={!canPreview} className="ghost-button ghost-button-dark mt-3 w-full rounded-full px-4 py-3 text-sm font-medium disabled:opacity-35">
                  打开预览
                </button>
              </section>

              <section className="premium-shell rounded-[1.6rem] p-4 sm:rounded-[2rem]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="eyebrow">步骤</p>
                    <h2 className="mt-3 text-[1.1rem] font-medium tracking-[-0.05em] text-white">完成这张作品</h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] tracking-[0.16em] text-white/38 uppercase">
                    {String(recordedCount).padStart(2, "0")} / {String(Math.max(1, spots.length)).padStart(2, "0")}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {stepCards.map((item) => (
                    <div key={`mobile-${item.key}`} className="rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-black">
                          {item.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <p className="mt-1 text-xs leading-5 text-white/44">{item.desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (item.key === "image") return triggerImagePicker();
                          if (item.key === "record") return handleRecordStep();
                          if (item.key === "preview") return handlePreviewStep();
                          return handleShareStep();
                        }}
                        disabled={item.disabled}
                        className="ghost-button ghost-button-dark mt-4 w-full rounded-full px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {item.action}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {selectedSpot && (
              <section id="record-panel-mobile" className="premium-shell rounded-[1.6rem] p-4 sm:rounded-[2rem]">
                <div className="rounded-[1.35rem] bg-white/[0.03] px-4 py-4 sm:rounded-[1.7rem]">
                    <p className="eyebrow">{selectedSpot === primarySpot ? "录音" : "录音段"}</p>
                    <h2 className="display-title mt-4 text-[2rem] leading-[0.88] text-white">{selectedSpot.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-white/46">说完这一句，它就会直接贴在作品上。</p>

                    {selectedSpot.audio && !recordedBlob && (
                      <button
                        onClick={() => togglePreviewAudio(selectedSpot)}
                        className="ghost-button ghost-button-dark mt-5 flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-medium"
                      >
                        {playingId === selectedSpot.id ? "暂停试听" : "播放试听"} · {formatSeconds(selectedSpot.audio.duration)}
                      </button>
                    )}

                    {!recording && !recordedBlob && (
                      <button onClick={startRecording} className="accent-button mt-3 w-full rounded-full px-4 py-3 text-sm font-medium">
                        {selectedSpot.audio ? "重新录音" : "开始录音"}
                      </button>
                    )}

                    {recording && (
                      <div className="mt-5 rounded-[1.4rem] border border-white/8 bg-white/[0.04] px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="relative flex h-3 w-3">
                            <span
                              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                              style={{ background: "rgba(255,255,255,0.82)" }}
                            />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-white">{recordingTime.toFixed(1)}s</span>
                          <span className="text-xs text-white/42">字幕 {liveSubs.length}{!speechSupported ? " (浏览器不支持实时字幕，录音保存后将用服务端转写)" : ""}</span>
                        </div>

                        {liveSubs.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {liveSubs.slice(-3).map((subtitle) => (
                              <div key={`mobile-${subtitle.id}`} className="rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-2 text-xs leading-6 text-white/72 animate-fade-up">
                                {subtitle.text}
                              </div>
                            ))}
                          </div>
                        )}

                        <button onClick={stopRecording} className="ghost-button ghost-button-dark mt-4 w-full rounded-full px-4 py-3 text-sm font-medium">
                          停止录音
                        </button>
                      </div>
                    )}

                    {recordedBlob && (
                      <div className="mt-5 rounded-[1.4rem] border border-white/8 bg-white/[0.04] px-4 py-4">
                        <p className="text-sm font-semibold text-white">录音完成 · {recordingTime.toFixed(1)}s</p>
                        <p className="mt-2 text-xs leading-6 text-white/46">不满意就重录。</p>
                        <div className="mt-4 flex gap-3">
                          <button onClick={saveRecording} className="accent-button flex-1 rounded-full px-4 py-3 text-sm font-medium">
                            保存这一段
                          </button>
                          <button onClick={() => setRecordedBlob(null)} className="ghost-button ghost-button-dark flex-1 rounded-full px-4 py-3 text-sm font-medium">
                            丢弃
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </section>
          </section>

          <aside className="hidden space-y-5 lg:block">
            <section className="premium-shell rounded-[2.4rem] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="eyebrow">步骤</p>
                  <h2 className="mt-3 text-[1.4rem] font-medium tracking-[-0.05em] text-white">完成这张作品</h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] tracking-[0.16em] text-white/38 uppercase">
                  {String(recordedCount).padStart(2, "0")} / {String(Math.max(1, spots.length)).padStart(2, "0")}
                </div>
              </div>
              <div className="mb-4 rounded-[1.4rem] border border-white/8 bg-white/[0.03] px-4 py-4">
                <p className="text-xs tracking-[0.16em] text-white/34 uppercase">定位</p>
                <p className="mt-2 text-sm leading-6 text-white/56">
                  点一下“定位播放键”，再在作品上落下它出现的位置。
                </p>
              </div>
              <div className="space-y-3">
                {stepCards.map((item) => (
                  <div key={item.key} className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-black">
                        {item.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-xs leading-6 text-white/44">{item.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (item.key === "image") return triggerImagePicker();
                        if (item.key === "record") return handleRecordStep();
                        if (item.key === "preview") return handlePreviewStep();
                        return handleShareStep();
                      }}
                      disabled={item.disabled}
                      className="ghost-button ghost-button-dark mt-4 w-full rounded-full px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {item.action}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {showAdvanced && spots.length > 1 && (
              <section className="premium-shell rounded-[2.4rem] p-5">
                <div className="mb-4">
                  <p className="eyebrow">多段</p>
                  <h2 className="mt-3 text-[1.3rem] font-medium tracking-[-0.05em] text-white">录音</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {spots.map((spot, index) => {
                    const isSelected = selectedId === spot.id;
                    return (
                      <div
                        key={spot.id}
                        onClick={() => setSelectedId(spot.id)}
                        className={`cursor-pointer rounded-[1.5rem] border px-4 py-4 transition-all ${
                          isSelected
                            ? "border-white/18 bg-white/[0.08] shadow-[0_14px_34px_rgba(0,0,0,0.16)]"
                            : "border-white/8 bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                            style={{ background: spot.color }}
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <input
                            value={spot.title}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setSpots((prev) =>
                                prev.map((item) =>
                                  item.id === spot.id ? { ...item, title: event.target.value } : item,
                                ),
                              )
                            }
                            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none"
                          />
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteSpot(spot.id);
                            }}
                            className="text-[11px] tracking-[0.16em] text-white/42 uppercase transition-opacity hover:opacity-75"
                          >
                            删除
                          </button>
                        </div>
                        <div className="mt-3 text-xs leading-6 text-white/42">
                          {spot.audio ? `${formatSeconds(spot.audio.duration)} · ${spot.audio.subtitles.length} 句` : "尚未录音"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {selectedSpot && (
              <section id="record-panel" className="premium-shell rounded-[2.4rem] p-5">
                <div className="rounded-[2rem] bg-white/[0.03] px-5 py-5">
                  <p className="eyebrow">{selectedSpot === primarySpot ? "录音" : "录音段"}</p>
                  <h2 className="display-title mt-4 text-[2.4rem] leading-[0.84] text-white">
                    {selectedSpot.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-white/46">
                    说完这一句，它就会直接贴在作品上。
                  </p>
                  {selectedSpot.audio && !recordedBlob && (
                    <button
                      onClick={() => togglePreviewAudio(selectedSpot)}
                      className="ghost-button ghost-button-dark mt-5 flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-medium"
                    >
                      {playingId === selectedSpot.id ? "暂停试听" : "播放试听"} · {formatSeconds(selectedSpot.audio.duration)}
                    </button>
                  )}

                  {!recording && !recordedBlob && (
                    <button onClick={startRecording} className="accent-button mt-3 w-full rounded-full px-4 py-3 text-sm font-medium">
                      {selectedSpot.audio ? "重新录音" : "开始录音"}
                    </button>
                  )}

                  {recording && (
                    <div className="mt-5 rounded-[1.6rem] border border-white/8 bg-white/[0.04] px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                          <span
                            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                            style={{ background: "rgba(255,255,255,0.82)" }}
                          />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-white">{recordingTime.toFixed(1)}s</span>
                        <span className="text-xs text-white/42">字幕 {liveSubs.length}</span>
                      </div>

                      {liveSubs.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {liveSubs.slice(-3).map((subtitle) => (
                            <div key={subtitle.id} className="rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-2 text-xs leading-6 text-white/72 animate-fade-up">
                              {subtitle.text}
                            </div>
                          ))}
                        </div>
                      )}

                      <button onClick={stopRecording} className="ghost-button ghost-button-dark mt-4 w-full rounded-full px-4 py-3 text-sm font-medium">
                        停止录音
                      </button>
                    </div>
                  )}

                  {recordedBlob && (
                    <div className="mt-5 rounded-[1.6rem] border border-white/8 bg-white/[0.04] px-4 py-4">
                      <p className="text-sm font-semibold text-white">录音完成 · {recordingTime.toFixed(1)}s</p>
                      <p className="mt-2 text-xs leading-6 text-white/46">不满意就重录。</p>
                      <div className="mt-4 flex gap-3">
                        <button onClick={saveRecording} className="accent-button flex-1 rounded-full px-4 py-3 text-sm font-medium">
                          保存这一段
                        </button>
                        <button onClick={() => setRecordedBlob(null)} className="ghost-button ghost-button-dark flex-1 rounded-full px-4 py-3 text-sm font-medium">
                          丢弃
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedSpot.audio && selectedSpot.audio.subtitles.length > 0 && (
                    <div className="mt-5 space-y-2">
                      <p className="eyebrow text-white/34">字幕</p>
                      {selectedSpot.audio.subtitles.map((subtitle) => (
                        <div key={subtitle.id} className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm leading-7 text-white/72">
                          <span className="mr-2 text-[11px] tabular-nums text-white/38">
                            {subtitle.startTime.toFixed(1)}s
                          </span>
                          {subtitle.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
          </aside>
        </main>
      </div>

      {showShare && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,5,5,0.84)] px-4 backdrop-blur-md"
          onClick={() => setShowShare(false)}
        >
          <div
            className="premium-shell w-full max-w-[980px] rounded-[2.6rem] p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="paper-stage px-6 py-6 sm:px-8 sm:py-8">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
                <div>
                  <p className="eyebrow text-black/34">{shareIsLocal ? "本机预览" : "分享"}</p>
                  <h3 className="display-title mt-4 text-[2.8rem] leading-[0.84] text-[var(--fg)] sm:text-[3.6rem]">
                    {shareIsLocal ? "先导出作品卡" : "这张作品，可以发出去了"}
                  </h3>
                  <p className="mt-4 max-w-[26rem] text-sm leading-7 text-black/54">
                    {shareIsLocal
                      ? "当前还是本机地址，更适合先导出 HTML 作品卡；部署后，链接和二维码就能直接发。"
                      : "点开就是作品本身，也能直接听见你的声音，看见字幕跟着走。"}
                  </p>

                  <div className="mt-6 flex items-center gap-2 rounded-[1.3rem] border border-black/[0.08] bg-black/[0.03] px-3 py-3 text-left">
                    <span className="min-w-0 flex-1 truncate text-xs text-black/46">{shareUrl}</span>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(shareUrl);
                        toast.success("链接已复制");
                      }}
                      className="ghost-button rounded-full px-4 py-2 text-xs font-medium"
                    >
                      复制
                    </button>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button onClick={handlePreviewStep} className="accent-button rounded-full px-5 py-3 text-sm font-medium">
                      打开成品卡
                    </button>
                    <button onClick={downloadHtml} className="ghost-button rounded-full px-5 py-3 text-sm font-medium">
                      导出 HTML
                    </button>
                    <button onClick={() => setShowShare(false)} className="ghost-button rounded-full px-5 py-3 text-sm font-medium">
                      关闭
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  {!shareIsLocal && qrDataUrl ? (
                    <Image
                      src={qrDataUrl}
                      alt="二维码"
                      width={208}
                      height={208}
                      unoptimized
                      className="h-52 w-52 rounded-[1.8rem] border border-black/[0.08] bg-white p-3"
                    />
                  ) : (
                    <div className="flex w-full max-w-[16rem] flex-col gap-3 rounded-[2rem] border border-black/[0.08] bg-black/[0.03] px-5 py-5 text-left">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-black/34">当前状态</p>
                      <p className="text-sm leading-7 text-black/58">
                        现在这份链接还是预览地址。先导出 HTML，更适合拿去测试和转发。
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

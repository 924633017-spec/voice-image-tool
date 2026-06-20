"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Sub = { id: string; text: string; startTime: number; endTime: number };
type Audio = { id: string; audioUrl: string; duration: number; subtitles: Sub[] };
type Spot = { id: string; x: number; y: number; color: string; title: string; audio: Audio | null };
type ProjectSettings = {
  playerPosition?: {
    x: number;
    y: number;
  };
};
type Proj = { id: string; title: string; coverImage: string | null; hotspots: Spot[]; settings?: string | null };
type SceneTheme = {
  key: "default";
  accent: string;
  orbGlow: string;
  controlBg: string;
  controlBorder: string;
  subtitleGlow: string;
  controlBottom: string;
};

export function PlayClient({ project }: { project: Proj }) {
  const searchParams = useSearchParams();
  const parsedSettings: ProjectSettings = (() => {
    if (!project.settings) return {};
    try {
      return JSON.parse(project.settings) as ProjectSettings;
    } catch {
      return {};
    }
  })();
  const [active, setActive] = useState<string | null>(project.hotspots.find((hotspot) => hotspot.audio)?.id ?? null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [imageBox, setImageBox] = useState({ width: 1120, height: 630 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playRequestRef = useRef(false);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const playableSpots = useMemo(
    () => project.hotspots.filter((hotspot) => hotspot.audio),
    [project.hotspots],
  );

  const activeSpot = useMemo(
    () => playableSpots.find((hotspot) => hotspot.id === active) ?? null,
    [active, playableSpots],
  );

  const currentSpot = activeSpot ?? playableSpots[0] ?? null;
  const currentSubtitle = currentSpot?.audio?.subtitles.find(
    (subtitle) => time >= subtitle.startTime && time < subtitle.endTime,
  );
  const projectTitle = project.title?.trim() || "未命名作品";
  const theme = useMemo<SceneTheme>(
    () => ({
      key: "default",
      accent: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.66))",
      orbGlow: "0 8px 20px rgba(255,255,255,0.1)",
      controlBg: "linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.035))",
      controlBorder: "rgba(255,255,255,0.1)",
      subtitleGlow: "0 4px 16px rgba(0,0,0,0.38)",
      controlBottom: "4.8%",
    }),
    [],
  );
  const progress = currentSpot?.audio?.duration ? (time / currentSpot.audio.duration) * 100 : 0;
  const currentSubtitleText = currentSubtitle?.text ?? (currentSpot?.audio ? "点一下，听听这张作品里留下的话。" : "暂无声音。");
  const uiScale = Math.min(1.08, Math.max(0.78, imageBox.width / 1080));
  const isCompactArtwork = imageBox.width < 640;
  const controlRadius = 999;
  const controlPaddingX = 11 * uiScale;
  const controlPaddingY = 6.5 * uiScale;
  const controlGap = 7 * uiScale;
  const playSize = 30 * uiScale;
  const playTriangle = 7.6 * uiScale;
  const playTriangleHeight = 4.8 * uiScale;
  const waveGap = 2.6 * uiScale;
  const waveWidth = 2.8 * uiScale;
  const subtitleFont = 0.82 * uiScale;
  const subtitleLineHeight = 1.18;
  const timeFont = 0.62 * uiScale;
  const showTime = imageBox.width >= 1100;
  const showSubtitle = Boolean(currentSpot?.audio);
  const subtitleMaxWidth = Math.min(
    Math.round(imageBox.width * (isCompactArtwork ? 0.46 : 0.34)),
    Math.round((isCompactArtwork ? 248 : 360) * uiScale),
  );
  const subtitleChars = currentSubtitle?.text.length ?? 0;
  const subtitleProgress =
    currentSubtitle && currentSubtitle.endTime > currentSubtitle.startTime
      ? Math.min(
          1,
          Math.max(0, (time - currentSubtitle.startTime) / (currentSubtitle.endTime - currentSubtitle.startTime)),
        )
      : 0;
  const subtitleShift =
    currentSubtitle && currentSubtitle.text.length > 12
      ? Math.max(0, currentSubtitle.text.length - 12) * subtitleProgress * 0.22
      : 0;
  const playerPosition = parsedSettings.playerPosition ?? { x: 6.1, y: 95.2 };
  const playerAnchorX = playerPosition.x >= 78 ? "right" : playerPosition.x <= 18 ? "left" : "center";
  const playerVerticalMode = playerPosition.y >= 78 ? "above" : "below";
  const playerTranslateX =
    playerAnchorX === "right" ? "-100%" : playerAnchorX === "center" ? "-50%" : "0%";
  const playerAlignItems =
    playerAnchorX === "right" ? "flex-end" : playerAnchorX === "center" ? "center" : "flex-start";
  const fromEditor = searchParams.get("from") === "editor";
  const backHref = fromEditor ? `/editor/${project.id}` : "/";
  const waveformPattern = [0.4, 0.7, 0.54, 0.86, 0.46, 0.34, 0.6, 0.48, 0.78, 0.92, 0.64, 0.42, 0.56, 0.36, 0.28, 0.5];
  const waveformBars = isCompactArtwork ? waveformPattern.slice(0, 10) : waveformPattern;
  const elapsedLabel = `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;

  async function toggleSpot(spot: Spot) {
    if (!spot.audio) return;

    const targetAudio = audioRef.current;
    if (!targetAudio) return;

    if (active !== spot.id) {
      playRequestRef.current = true;
      setActive(spot.id);
      return;
    } else if (playing) {
      targetAudio.pause();
      setPlaying(false);
      return;
    }

    if (targetAudio.ended || targetAudio.currentTime >= Math.max(0, spot.audio.duration - 0.08)) {
      targetAudio.currentTime = 0;
      setTime(0);
    }

    try {
      await targetAudio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncTime = () => setTime(audio.currentTime);
    const syncPlay = () => setPlaying(true);
    const syncPause = () => setPlaying(false);
    const syncEnded = () => {
      setPlaying(false);
      setTime(currentSpot?.audio?.duration ?? audio.duration ?? 0);
    };

    audio.addEventListener("timeupdate", syncTime);
    audio.addEventListener("play", syncPlay);
    audio.addEventListener("pause", syncPause);
    audio.addEventListener("ended", syncEnded);

    return () => {
      audio.removeEventListener("timeupdate", syncTime);
      audio.removeEventListener("play", syncPlay);
      audio.removeEventListener("pause", syncPause);
      audio.removeEventListener("ended", syncEnded);
    };
  }, [currentSpot?.audio?.duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const currentAudio = currentSpot?.audio;

    audio.pause();
    audio.currentTime = 0;
    setTime(0);
    setPlaying(false);

    if (!currentAudio) {
      playRequestRef.current = false;
      return;
    }

    audio.load();

    if (!playRequestRef.current) return;

    const start = async () => {
      try {
        await audio.play();
      } catch {
        setPlaying(false);
      } finally {
        playRequestRef.current = false;
      }
    };

    if (audio.readyState >= 2) {
      void start();
      return;
    }

    const handleCanPlay = () => {
      audio.removeEventListener("canplay", handleCanPlay);
      void start();
    };

    audio.addEventListener("canplay", handleCanPlay);

    return () => audio.removeEventListener("canplay", handleCanPlay);
  }, [currentSpot?.audio]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    const img = frame?.querySelector("img");
    if (!img) return;

    const updateSize = () => {
      const rect = img.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setImageBox({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(img);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [project.coverImage]);

  return (
    <div className="site-shell min-h-screen bg-black px-4 py-5 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
      <main className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1560px] flex-col justify-center sm:min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)]">
        <div className="mb-4 flex items-center justify-start sm:mb-5">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="ghost-button ghost-button-dark inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-medium tracking-[0.18em] uppercase text-white/76"
            >
              <span className="text-sm leading-none">‹</span>
              <span>{fromEditor ? "回到制作" : "返回"}</span>
            </Link>
            {fromEditor && (
              <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] tracking-[0.16em] text-white/34 uppercase backdrop-blur-md sm:inline-flex">
                预览中
              </div>
            )}
          </div>
        </div>

        <section className="w-full">
          {project.coverImage ? (
            <div className="relative mx-auto w-full max-w-[1220px] sm:max-w-[1320px] lg:max-w-[1420px]">
              <audio
                ref={audioRef}
                src={currentSpot?.audio?.audioUrl ?? undefined}
                preload="auto"
                playsInline
                className="hidden"
              />

              <div ref={frameRef} className="relative">
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[58%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(circle,rgba(255,255,255,0.1),rgba(255,255,255,0.02)_48%,transparent_74%)] blur-3xl" />
                <div className="pointer-events-none absolute inset-x-[18%] bottom-[2%] h-[14%] rounded-[50%] bg-black/38 blur-3xl" />

                <div className="relative z-10 mx-auto w-fit overflow-hidden rounded-[1.4rem] shadow-[0_30px_80px_rgba(0,0,0,0.24)] sm:rounded-[2.2rem]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={project.coverImage}
                    alt={projectTitle}
                    loading="eager"
                    className="block max-h-[68vh] w-auto max-w-full object-contain sm:max-h-[78vh] lg:max-h-[86vh]"
                  />

                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0)_58%,rgba(0,0,0,0.14)_78%,rgba(0,0,0,0.32)_100%)]" />
                  <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex justify-between gap-3 sm:inset-x-5 sm:top-5">
                    <div className="rounded-full border border-white/10 bg-black/24 px-3 py-2 text-[11px] tracking-[0.14em] text-white/52 uppercase backdrop-blur-xl">
                      {projectTitle}
                    </div>
                    {fromEditor && (
                      <div className="rounded-full border border-white/10 bg-black/24 px-3 py-2 text-[11px] tracking-[0.14em] text-white/42 uppercase backdrop-blur-xl">
                        成品预览
                      </div>
                    )}
                  </div>
                  
                  <div
                    className="pointer-events-none absolute z-20"
                    style={{
                      left: `${playerPosition.x}%`,
                      top: `${playerPosition.y}%`,
                      transform: `translate(${playerTranslateX}, -50%)`,
                    }}
                  >
                    <div className="relative flex flex-col" style={{ alignItems: playerAlignItems }}>
                      <div className="pointer-events-none absolute -left-[8%] top-[36%] h-[132%] w-[116%] rounded-[999px] bg-[radial-gradient(circle,rgba(255,255,255,0.14),rgba(255,255,255,0.02)_54%,transparent_76%)] blur-2xl" />

                      {showSubtitle && playerVerticalMode === "above" && (
                        <div
                          className="pointer-events-none relative mb-2 overflow-hidden"
                          style={{
                            maxWidth: `${subtitleMaxWidth}px`,
                            maskImage: "linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)",
                            WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)",
                          }}
                        >
                          <div className="pointer-events-none absolute inset-x-0 -inset-y-2 rounded-[999px] bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,0.18)_14%,rgba(0,0,0,0.14)_86%,rgba(0,0,0,0))] blur-xl" />

                          {currentSubtitle ? (
                            <p
                              className="relative w-max max-w-none whitespace-nowrap transition-transform duration-200"
                              style={{
                                transform: `translateX(-${subtitleShift}em)`,
                                fontSize: `${(isCompactArtwork ? 0.8 : subtitleFont).toFixed(2)}rem`,
                                lineHeight: subtitleLineHeight,
                                textShadow: theme.subtitleGlow,
                              }}
                            >
                              {currentSubtitle.text.split("").map((char, index) => {
                                const totalChars = subtitleChars || 1;
                                const durationPerChar =
                                  (currentSubtitle.endTime - currentSubtitle.startTime) / totalChars;
                                const charStart = currentSubtitle.startTime + index * durationPerChar;
                                const charEnd = charStart + durationPerChar;
                                const isCurrent = time >= charStart && time < charEnd;
                                const hasPassed = time >= charEnd;

                                return (
                                  <span
                                    key={`${currentSubtitle.id}-top-${index}`}
                                    className="transition-all duration-200"
                                    style={{
                                      color: isCurrent
                                        ? "rgba(255,255,255,1)"
                                        : hasPassed
                                          ? "rgba(255,255,255,0.74)"
                                          : "rgba(255,255,255,0.3)",
                                      textShadow: isCurrent ? `0 0 10px rgba(255,255,255,0.16), ${theme.subtitleGlow}` : theme.subtitleGlow,
                                      transform: isCurrent ? "translateY(-0.4px)" : "translateY(0px)",
                                    }}
                                  >
                                    {char}
                                  </span>
                                );
                              })}
                            </p>
                          ) : (
                            <p
                              className="relative text-white/72"
                              style={{
                                fontSize: `${(isCompactArtwork ? 0.8 : subtitleFont).toFixed(2)}rem`,
                                lineHeight: subtitleLineHeight,
                                textShadow: theme.subtitleGlow,
                              }}
                            >
                              {currentSubtitleText}
                            </p>
                          )}
                        </div>
                      )}

                      <div
                        className="pointer-events-auto relative inline-flex items-center border border-white/9 backdrop-blur-[18px]"
                        style={{
                          gap: `${controlGap}px`,
                          borderRadius: `${controlRadius}px`,
                          padding: `${Math.max(5, controlPaddingY - 2)}px ${Math.max(9, controlPaddingX - 2)}px`,
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 10px 22px rgba(0,0,0,0.06)",
                          background: theme.controlBg,
                          borderColor: theme.controlBorder,
                          opacity: 0.76,
                        }}
                      >
                        {currentSpot?.audio && (
                          <button
                            onClick={() => toggleSpot(currentSpot)}
                            aria-label={playing ? "暂停讲述" : "播放讲述"}
                            className="play-orb relative flex shrink-0 items-center justify-center rounded-full text-black transition-all duration-300 hover:scale-[1.04] active:scale-95"
                            style={{
                              height: `${playSize}px`,
                              width: `${playSize}px`,
                              background: theme.accent,
                              boxShadow: theme.orbGlow,
                            }}
                            title={projectTitle}
                          >
                            {playing ? (
                              <span className="relative z-10 flex gap-[3px]">
                                <span
                                  className="rounded-full bg-black/88"
                                  style={{ width: `${Math.max(2, 2 * uiScale)}px`, height: `${12 * uiScale}px` }}
                                />
                                <span
                                  className="rounded-full bg-black/88"
                                  style={{ width: `${Math.max(2, 2 * uiScale)}px`, height: `${12 * uiScale}px` }}
                                />
                              </span>
                            ) : (
                              <span
                                className="relative z-10 ml-[1px] h-0 w-0 border-b-transparent border-l-black border-t-transparent"
                                style={{
                                  borderTopWidth: `${playTriangleHeight}px`,
                                  borderBottomWidth: `${playTriangleHeight}px`,
                                  borderLeftWidth: `${playTriangle}px`,
                                }}
                              />
                            )}
                          </button>
                        )}

                        <div className="flex items-center" style={{ gap: `${isCompactArtwork ? 2 : waveGap}px` }}>
                          {waveformBars.map((heightFactor, index) => {
                            const barProgress = waveformBars.length <= 1 ? 0 : index / (waveformBars.length - 1);
                            const active = progress / 100 >= barProgress;
                            const pulse = playing ? 0.1 * Math.sin(time * 4.2 + index * 0.7) : 0;
                            const barHeight = Math.max(4, (4 + heightFactor * (isCompactArtwork ? 11 : 14) + pulse * 5) * uiScale);
                            return (
                              <span
                                key={index}
                                className="shrink-0 rounded-full transition-all duration-150"
                                style={{
                                  width: `${Math.max(2, isCompactArtwork ? waveWidth - 0.6 : waveWidth)}px`,
                                  height: `${barHeight}px`,
                                  background: active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.26)",
                                }}
                              />
                            );
                          })}
                        </div>

                        {showTime && (
                          <span
                            className="shrink-0 text-white/72"
                            style={{
                              fontSize: `${timeFont}rem`,
                              lineHeight: 1,
                              letterSpacing: "0.01em",
                            }}
                          >
                            {elapsedLabel}
                          </span>
                        )}
                      </div>

                      {showSubtitle && playerVerticalMode === "below" && (
                        <div
                          className="pointer-events-none relative mt-2 overflow-hidden"
                          style={{
                            maxWidth: `${subtitleMaxWidth}px`,
                            maskImage: "linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)",
                            WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)",
                          }}
                        >
                          <div className="pointer-events-none absolute inset-x-0 -inset-y-2 rounded-[999px] bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,0.18)_14%,rgba(0,0,0,0.14)_86%,rgba(0,0,0,0))] blur-xl" />

                          {currentSubtitle ? (
                            <p
                              className="relative w-max max-w-none whitespace-nowrap transition-transform duration-200"
                              style={{
                                transform: `translateX(-${subtitleShift}em)`,
                                fontSize: `${(isCompactArtwork ? 0.8 : subtitleFont).toFixed(2)}rem`,
                                lineHeight: subtitleLineHeight,
                                textShadow: theme.subtitleGlow,
                              }}
                            >
                              {currentSubtitle.text.split("").map((char, index) => {
                                const totalChars = subtitleChars || 1;
                                const durationPerChar =
                                  (currentSubtitle.endTime - currentSubtitle.startTime) / totalChars;
                                const charStart = currentSubtitle.startTime + index * durationPerChar;
                                const charEnd = charStart + durationPerChar;
                                const isCurrent = time >= charStart && time < charEnd;
                                const hasPassed = time >= charEnd;

                                return (
                                  <span
                                    key={`${currentSubtitle.id}-${index}`}
                                    className="transition-all duration-200"
                                    style={{
                                      color: isCurrent
                                        ? "rgba(255,255,255,1)"
                                        : hasPassed
                                          ? "rgba(255,255,255,0.74)"
                                          : "rgba(255,255,255,0.3)",
                                      textShadow: isCurrent ? `0 0 10px rgba(255,255,255,0.16), ${theme.subtitleGlow}` : theme.subtitleGlow,
                                      transform: isCurrent ? "translateY(-0.4px)" : "translateY(0px)",
                                    }}
                                  >
                                    {char}
                                  </span>
                                );
                              })}
                            </p>
                          ) : (
                            <p
                              className="relative text-white/72"
                              style={{
                                fontSize: `${(isCompactArtwork ? 0.8 : subtitleFont).toFixed(2)}rem`,
                                lineHeight: subtitleLineHeight,
                                textShadow: theme.subtitleGlow,
                              }}
                            >
                              {currentSubtitleText}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[720px] items-center justify-center">
              <p className="display-title text-4xl text-white/16">等待图片</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

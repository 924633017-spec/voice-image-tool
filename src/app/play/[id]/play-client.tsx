"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Sub = { id: string; text: string; startTime: number; endTime: number };
type Audio = { id: string; audioUrl: string; duration: number; subtitles: Sub[] };
type Spot = { id: string; x: number; y: number; color: string; title: string; audio: Audio | null };
type Proj = { id: string; title: string; coverImage: string | null; hotspots: Spot[]; settings?: string | null };

export function PlayClient({ project }: { project: Proj }) {
  const searchParams = useSearchParams();
  const fromEditor = searchParams.get("from") === "editor";
  const projectTitle = project.title?.trim() || "未命名作品";
  const playableSpots = useMemo(
    () => project.hotspots.filter((spot) => spot.audio),
    [project.hotspots],
  );

  const [activeId, setActiveId] = useState<string | null>(playableSpots[0]?.id ?? null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [imageBox, setImageBox] = useState({ width: 1120, height: 630 });

  const activeSpot = useMemo(
    () => playableSpots.find((s) => s.id === activeId) ?? null,
    [activeId, playableSpots],
  );

  const currentSubtitle = activeSpot?.audio?.subtitles.find(
    (s) => time >= s.startTime && time < s.endTime,
  );

  // Audio element management
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setTime(audio.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => { setPlaying(false); setTime(activeSpot?.audio?.duration ?? audio.duration ?? 0); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
    };
  }, [activeSpot?.audio?.duration]);

  // Image size tracking
  useEffect(() => {
    const img = frameRef.current?.querySelector("img");
    if (!img) return;
    const update = () => {
      const r = img.getBoundingClientRect();
      if (r.width && r.height) setImageBox({ width: Math.round(r.width), height: Math.round(r.height) });
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(img);
    window.addEventListener("resize", update);
    return () => { obs.disconnect(); window.removeEventListener("resize", update); };
  }, [project.coverImage]);

  const toggleSpot = useCallback((spot: Spot) => {
    if (!spot.audio) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (activeId === spot.id) {
      // Same spot: toggle play/pause
      if (playing) {
        audio.pause();
      } else {
        if (audio.ended || audio.currentTime >= (spot.audio.duration - 0.08)) {
          audio.currentTime = 0;
        }
        audio.play().catch(() => {});
      }
      return;
    }

    // Different spot: switch and play (sync play() in click handler for iOS)
    audio.pause();
    setActiveId(spot.id);
    setTime(0);
    // Set src and play immediately — the play() promise is tied to user gesture
    audio.src = spot.audio.audioUrl;
    audio.load();
    audio.play().catch(() => {});
  }, [activeId, playing]);

  const backHref = fromEditor ? `/editor/${project.id}` : "/";

  if (!project.coverImage) {
    return (
      <div className="site-shell flex min-h-screen items-center justify-center bg-black px-6">
        <p className="text-white/30 text-lg">暂无作品图</p>
      </div>
    );
  }

  return (
    <div className="site-shell min-h-screen bg-black px-4 py-5 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
      <main className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1560px] flex-col justify-center sm:min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)]">
        {/* Top bar */}
        <div className="mb-4 flex items-center gap-3 sm:mb-5">
          <Link href={backHref} className="ghost-button ghost-button-dark inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-medium tracking-[0.18em] uppercase text-white/76">
            <span className="text-sm leading-none">‹</span>
            <span>{fromEditor ? "回到制作" : "返回"}</span>
          </Link>
          <div className="rounded-full border border-white/10 bg-black/24 px-3 py-2 text-[11px] tracking-[0.14em] text-white/52 uppercase backdrop-blur-xl">
            {projectTitle}
          </div>
          {playableSpots.length > 1 && (
            <div className="rounded-full border border-white/10 bg-black/24 px-3 py-2 text-[11px] tracking-[0.14em] text-white/42 uppercase backdrop-blur-xl">
              {playableSpots.length} 段录音
            </div>
          )}
        </div>

        <section className="w-full">
          {/* Hidden audio element */}
          <audio ref={audioRef} src={activeSpot?.audio?.audioUrl ?? undefined} preload="auto" className="hidden" />

          <div ref={frameRef} className="relative mx-auto w-full max-w-[1420px]">
            {/* Ambient glow */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[58%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(circle,rgba(255,255,255,0.1),rgba(255,255,255,0.02)_48%,transparent_74%)] blur-3xl" />
            <div className="pointer-events-none absolute inset-x-[18%] bottom-[2%] h-[14%] rounded-[50%] bg-black/38 blur-3xl" />

            <div className="relative z-10 mx-auto w-fit overflow-hidden rounded-[1.4rem] shadow-[0_30px_80px_rgba(0,0,0,0.24)] sm:rounded-[2.2rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={project.coverImage}
                alt={projectTitle}
                className="block max-h-[68vh] w-auto max-w-full object-contain sm:max-h-[78vh] lg:max-h-[86vh]"
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0)_58%,rgba(0,0,0,0.14)_78%,rgba(0,0,0,0.32)_100%)]" />

              {/* Multi-spot playback buttons */}
              {playableSpots.map((spot, index) => {
                const isActive = activeId === spot.id;
                const isPlaying = isActive && playing;
                const sub = isActive ? currentSubtitle : null;
                const anchorX = spot.x >= 78 ? "right" : spot.x <= 18 ? "left" : "center";
                const vMode = spot.y >= 78 ? "above" : "below";
                const tx = anchorX === "right" ? "-100%" : anchorX === "center" ? "-50%" : "0%";
                const ai = anchorX === "right" ? "flex-end" : anchorX === "center" ? "center" : "flex-start";
                const uiScale = Math.min(1.08, Math.max(0.78, imageBox.width / 1080));

                return (
                  <div
                    key={spot.id}
                    className="absolute z-30"
                    style={{
                      left: `${spot.x}%`,
                      top: `${spot.y}%`,
                      transform: `translate(${tx}, -50%)`,
                    }}
                  >
                    {/* Subtitle (above) */}
                    {vMode === "above" && sub && (
                      <div className="pointer-events-none mb-1.5 overflow-hidden" style={{ maxWidth: `${Math.min(imageBox.width * 0.34, 360 * uiScale)}px` }}>
                        <div className="rounded-full bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,0.2)_14%,rgba(0,0,0,0.15)_86%,rgba(0,0,0,0))] px-2 py-1 backdrop-blur-sm">
                          <p className="whitespace-nowrap text-center text-[12px] leading-[1.35] text-white/80" style={{ fontSize: `${0.8 * uiScale}rem` }}>
                            {sub.text.split("").map((char, ci) => {
                              const total = sub.text.length || 1;
                              const perChar = (sub.endTime - sub.startTime) / total;
                              const cs = sub.startTime + ci * perChar;
                              const ce = cs + perChar;
                              const cur = time >= cs && time < ce;
                              const past = time >= ce;
                              return (
                                <span key={ci} style={{
                                  color: cur ? "rgba(255,255,255,1)" : past ? "rgba(255,255,255,0.74)" : "rgba(255,255,255,0.3)",
                                  textShadow: cur ? "0 0 10px rgba(255,255,255,0.16)" : "none",
                                }}>{char}</span>
                              );
                            })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Play button */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: ai }}>
                      <button
                        onClick={() => toggleSpot(spot)}
                        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))] px-2.5 py-2 backdrop-blur-xl shadow-[0_6px_16px_rgba(0,0,0,0.12)] transition-all hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0.08))] hover:scale-105 active:scale-95"
                      >
                        {/* Play/pause icon */}
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
                          style={{ background: spot.color }}
                        >
                          {isPlaying ? (
                            <span className="flex gap-[2px]">
                              <span className="h-3 w-0.5 rounded-full bg-white" />
                              <span className="h-3 w-0.5 rounded-full bg-white" />
                            </span>
                          ) : (
                            <span className="ml-0.5 h-0 w-0 border-y-[4px] border-l-[7px] border-y-transparent border-l-white" />
                          )}
                        </span>
                        {/* Spot number */}
                        <span className="text-[10px] font-medium text-white/50">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {/* Waveform bars when playing */}
                        {isPlaying && (
                          <div className="flex items-center gap-[2px]">
                            {[0.4, 0.7, 0.54, 0.86, 0.46, 0.34, 0.6, 0.48].map((h, i) => {
                              const p = spot.audio ? time / spot.audio.duration : 0;
                              const active = p >= i / 8;
                              return (
                                <span
                                  key={i}
                                  className="w-[2px] rounded-full transition-all duration-150"
                                  style={{
                                    height: `${4 + h * 10}px`,
                                    background: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)",
                                  }}
                                />
                              );
                            })}
                          </div>
                        )}
                      </button>
                    </div>

                    {/* Subtitle (below) */}
                    {vMode === "below" && sub && (
                      <div className="pointer-events-none mt-1.5 overflow-hidden" style={{ maxWidth: `${Math.min(imageBox.width * 0.34, 360 * uiScale)}px` }}>
                        <div className="rounded-full bg-[linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,0.2)_14%,rgba(0,0,0,0.15)_86%,rgba(0,0,0,0))] px-2 py-1 backdrop-blur-sm">
                          <p className="whitespace-nowrap text-center text-[12px] leading-[1.35] text-white/80" style={{ fontSize: `${0.8 * uiScale}rem` }}>
                            {sub.text.split("").map((char, ci) => {
                              const total = sub.text.length || 1;
                              const perChar = (sub.endTime - sub.startTime) / total;
                              const cs = sub.startTime + ci * perChar;
                              const ce = cs + perChar;
                              const cur = time >= cs && time < ce;
                              const past = time >= ce;
                              return (
                                <span key={ci} style={{
                                  color: cur ? "rgba(255,255,255,1)" : past ? "rgba(255,255,255,0.74)" : "rgba(255,255,255,0.3)",
                                  textShadow: cur ? "0 0 10px rgba(255,255,255,0.16)" : "none",
                                }}>{char}</span>
                              );
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* No audio hint */}
              {playableSpots.length === 0 && (
                <div className="pointer-events-none absolute left-1/2 top-[84%] z-20 -translate-x-1/2">
                  <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-[11px] text-white/40 backdrop-blur-md">
                    暂无录音
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

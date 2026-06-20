"use client";

import { startTransition, useEffect, useState } from "react";

type Category = {
  id: string;
  label: string;
  title: string;
  caption: string;
  tone: string;
  image: string;
  heroTitle: string;
  heroBody: string;
};

export function HomeGalleryStage({
  categories,
  startHref,
}: {
  categories: readonly Category[];
  startHref: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPaused, setIsAutoPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const active = categories[activeIndex] ?? categories[0];
  const orderedCategories = categories.map((_, offset) => {
    const index = (activeIndex + offset) % categories.length;
    return {
      item: categories[index],
      index,
      rank: offset,
    };
  });

  function selectIndex(index: number) {
    if (index === activeIndex) return;
    setIsTransitioning(true);
    startTransition(() => setActiveIndex(index));
  }

  function step(direction: "prev" | "next") {
    const nextIndex =
      direction === "next"
        ? (activeIndex + 1) % categories.length
        : (activeIndex - 1 + categories.length) % categories.length;
    selectIndex(nextIndex);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setIsTransitioning(false), 520);
    return () => window.clearTimeout(timer);
  }, [activeIndex]);

  useEffect(() => {
    if (isAutoPaused || categories.length <= 1) return;

    const timer = window.setInterval(() => {
      startTransition(() => {
        setActiveIndex((current) => (current + 1) % categories.length);
      });
    }, 3400);

    return () => window.clearInterval(timer);
  }, [categories.length, isAutoPaused]);

  return (
    <>
      <section className="gallery-stage overflow-hidden rounded-[2.2rem] border border-white/10">
        <div className="gallery-stage-overlay" />

        <div className="relative z-10 p-5 sm:p-8 lg:p-10">
          <div className="gallery-stage-layout">
            <div className={`gallery-copy-block ${isTransitioning ? "is-transitioning" : ""}`}>
              <p className="eyebrow text-white/42">为你的作品发声</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/16 px-3 py-1.5 text-[11px] tracking-[0.18em] text-white/52 uppercase backdrop-blur-md">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/52" />
                <span>{active.label}</span>
              </div>
              <h1 className="display-title mt-8 max-w-[8.6em] whitespace-pre-line text-[1.9rem] leading-[0.94] tracking-[-0.055em] text-white sm:text-[2.5rem] lg:text-[2.95rem] xl:text-[3.1rem]">
                {active.heroTitle}
              </h1>
              <p className="mt-6 max-w-[16.75rem] text-[12px] leading-[1.95] text-white/40 lg:max-w-[17.5rem]">
                {active.heroBody}
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <a
                  href={startHref}
                  className="ghost-button ghost-button-dark inline-flex items-center justify-center rounded-full px-7 py-3 text-sm font-medium"
                >
                  开始制作
                </a>
              </div>
            </div>

            <div className="gallery-showcase">
              <div className="hidden items-center justify-end lg:flex">
                <div className="gallery-pills">
                  {categories.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectIndex(index)}
                      aria-pressed={activeIndex === index}
                      className={`gallery-pill-button ${activeIndex === index ? "is-active" : ""}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gallery-rail-stage">
                <div className="gallery-spotlight" />
                <div
                  className="gallery-rail-wrap"
                  onMouseEnter={() => setIsAutoPaused(true)}
                  onMouseLeave={() => setIsAutoPaused(false)}
                  onFocusCapture={() => setIsAutoPaused(true)}
                  onBlurCapture={() => setIsAutoPaused(false)}
                >
                  <div className="gallery-rail-meta">
                    <div className="gallery-rail-copy">
                      <p className="gallery-rail-label">{active.label}</p>
                      <p className="gallery-rail-hint">
                        {active.caption}
                        <span className="ml-2 hidden text-white/22 sm:inline">{isAutoPaused ? "已暂停" : "自动滚动"}</span>
                      </p>
                    </div>

                    <div className="gallery-rail-controls">
                      <button
                        type="button"
                        onClick={() => step("prev")}
                        aria-label="查看上一组作品"
                        className="gallery-rail-button"
                      >
                        <span>‹</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => step("next")}
                        aria-label="查看下一组作品"
                        className="gallery-rail-button"
                      >
                        <span>›</span>
                      </button>
                    </div>
                  </div>

                  <div className="gallery-rail" role="region" aria-label="作品分类滑动展示">
                    {orderedCategories.map(({ item, index, rank }) => (
                      <button
                        key={item.id}
                        type="button"
                        data-gallery-card="true"
                        data-rank={rank}
                        onClick={() => selectIndex(index)}
                        aria-pressed={activeIndex === index}
                        className={`gallery-card text-left ${activeIndex === index ? "is-active" : ""}`}
                      >
                        <div className={`gallery-card-glow bg-gradient-to-br ${item.tone}`} />
                        <div className="gallery-card-image-wrap">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.image} alt={item.label} className="gallery-card-image" />
                        </div>
                        <div className="gallery-card-overlay" />
                        <div className="gallery-card-body">
                          <span className="gallery-card-tag">{item.label}</span>
                          <div className="mt-auto">
                            <p className="gallery-card-title">{item.title}</p>
                            <p className="gallery-card-caption">{item.caption}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

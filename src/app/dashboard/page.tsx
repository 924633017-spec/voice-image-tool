import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectCardActions } from "./project-card-actions";

type DashboardProject = {
  id: string;
  title: string;
  coverImage: string | null;
  settings: string;
  updatedAt: Date;
  hotspots: {
    id: string;
    audio: { id: string } | null;
  }[];
};

function canPlayProject(project: DashboardProject) {
  const audioCount = project.hotspots.filter((hotspot) => hotspot.audio).length;

  try {
    const settings = JSON.parse(project.settings || "{}") as {
      playerPosition?: { x: number; y: number };
    };

    return Boolean(project.coverImage && audioCount > 0 && settings.playerPosition);
  } catch {
    return Boolean(project.coverImage && audioCount > 0);
  }
}

function displayProjectTitle(project: Pick<DashboardProject, "title" | "coverImage" | "hotspots">) {
  const normalized = project.title.trim();
  if (!normalized || normalized === "新的作品" || normalized === "未命名作品") {
    return project.coverImage || project.hotspots.length > 0 ? "未命名作品" : "新的草稿";
  }
  return normalized;
}

function formatRelative(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))} 分钟前`;
  if (diff < day) return `${Math.round(diff / hour)} 小时前`;
  return `${Math.round(diff / day)} 天前`;
}

function projectState(project: DashboardProject) {
  const audioCount = project.hotspots.filter((hotspot) => hotspot.audio).length;
  const hasHotspots = project.hotspots.length > 0;
  let playerPositionReady = false;

  try {
    const settings = JSON.parse(project.settings || "{}") as {
      playerPosition?: { x: number; y: number };
    };
    playerPositionReady = Boolean(settings.playerPosition);
  } catch {}

  if (!project.coverImage) return "待放图";
  if (!hasHotspots) return "待落点";
  if (audioCount === 0) return "待录音";
  if (!playerPositionReady) return "待定位";
  return "可分享";
}

function ProjectCard({ project }: { project: DashboardProject }) {
  const state = projectState(project);
  const playable = canPlayProject(project);
  const displayTitle = displayProjectTitle(project);

  return (
    <article className="group premium-shell overflow-hidden rounded-[2.2rem] p-3 transition-transform duration-500 hover:-translate-y-1">
      <Link href={`/editor/${project.id}`} className="block">
        <div className="paper-stage relative aspect-[4/3] overflow-hidden rounded-[1.75rem] p-4">
          {project.coverImage ? (
            <Image
              src={project.coverImage}
              alt={project.title}
              fill
              sizes="(min-width: 1024px) 28vw, 100vw"
              className="object-contain p-6 transition-transform duration-700 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="paper-grid flex h-full items-center justify-center rounded-[1.4rem]">
              <div className="text-center">
                <p className="text-[11px] tracking-[0.18em] text-black/30 uppercase">草稿中</p>
                <span className="display-title mt-3 block text-[2.2rem] text-black/18">放入作品图</span>
              </div>
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-4 p-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/8 bg-white/6 px-3 py-1 text-[11px] tracking-[0.16em] text-white/44 uppercase">
              {state}
            </span>
            <span className="rounded-full border border-white/8 bg-white/6 px-3 py-1 text-[11px] tracking-[0.16em] text-white/34 uppercase">
              更新于 {formatRelative(project.updatedAt)}
            </span>
          </div>

          <ProjectCardActions projectId={project.id} title={displayTitle} canPlay={playable} />
        </div>

        <Link href={`/editor/${project.id}`} className="block">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="display-title text-[2rem] leading-[0.88] text-white">{displayTitle}</h3>
          </div>
        </Link>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="premium-shell rounded-[2.5rem] p-3">
      <div className="paper-stage px-8 py-16 text-center">
        <h2 className="display-title mt-4 text-[2.8rem] leading-[0.86] text-[var(--fg)]">先做第一张</h2>
        <Link href="/editor/new" className="accent-button mt-8 inline-flex rounded-full px-7 py-3.5 text-sm font-medium">
          开始
        </Link>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="premium-shell overflow-hidden rounded-[2rem] p-3">
      <div className="aspect-[4/3] rounded-[1.5rem] skeleton" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-28 skeleton" />
        <div className="h-8 w-2/3 skeleton" />
        <div className="h-3 w-full skeleton" />
      </div>
    </div>
  );
}

async function ProjectSections() {
  const session = await auth();
  if (!session?.user) return null;

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { hotspots: { include: { audio: true } } },
  });

  if (projects.length === 0) return <EmptyState />;

  const recent = projects.slice(0, 1) as DashboardProject[];
  const others = projects.slice(1) as DashboardProject[];

  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="eyebrow">最近</p>
            <h2 className="section-title mt-3 text-white">继续制作</h2>
          </div>
          <Link href="/editor/new" className="ghost-button ghost-button-dark hidden rounded-full px-5 py-2.5 text-sm font-medium md:inline-flex">
            新建
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {recent.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>

      {others.length > 0 && (
        <section className="space-y-5">
          <div>
            <p className="eyebrow">其他</p>
            <h2 className="section-title mt-3 text-white">作品</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {others.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:py-12">
      <section className="mb-10 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_320px]">
        <div className="premium-shell rounded-[2.6rem] px-8 py-9 sm:px-10 sm:py-10">
          <p className="eyebrow">作品</p>
          <h1 className="display-title mt-4 text-[3rem] leading-[0.84] text-white sm:text-[4.4rem]">你的作品</h1>
        </div>

        <div className="premium-shell rounded-[2.6rem] px-5 py-5">
          <div className="rounded-[2rem] bg-white/[0.03] px-5 py-5">
            <p className="eyebrow">新建</p>
            <Link href="/editor/new" className="ghost-button ghost-button-dark mt-6 inline-flex rounded-full px-5 py-2.5 text-sm font-medium">
              开始
            </Link>
          </div>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        }
      >
        <ProjectSections />
      </Suspense>
    </div>
  );
}

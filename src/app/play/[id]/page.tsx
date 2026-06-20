import { prisma } from "@/lib/prisma";
import { PlayClient } from "./play-client";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

async function getProjectForPlay(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      hotspots: {
        orderBy: { orderNum: "asc" },
        include: {
          audio: {
            include: {
              subtitles: { orderBy: { startTime: "asc" } },
            },
          },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectForPlay(id);

  const playableCount = project?.hotspots.filter((hotspot) => hotspot.audio).length ?? 0;
  const description = project
    ? `${playableCount > 0 ? `含 ${playableCount} 段本人录音，` : ""}点开作品，听亲口讲述，看同步字幕。`
    : "点开作品，听亲口讲述，看同步字幕。";

  return {
    title: project ? `${project.title}｜图述` : "图述",
    description,
    openGraph: {
      title: project?.title ?? "图述",
      description,
      images: [
        {
          url: `/play/${id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: project?.title ?? "图述",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: project?.title ?? "图述",
      description,
      images: [`/play/${id}/opengraph-image`],
    },
  };
}

export default async function PlayPage({ params }: Props) {
  const { id } = await params;

  const project = await getProjectForPlay(id);

  const playableCount = project?.hotspots.filter((hotspot) => hotspot.audio).length ?? 0;

  if (!project || !project.coverImage || playableCount === 0) {
    notFound();
  }

  return (
    <PlayClient
      project={JSON.parse(JSON.stringify(project))}
    />
  );
}

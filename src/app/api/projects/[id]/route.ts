import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = await req.json();

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: {
        title: data.title,
        coverImage: data.coverImage,
        settings: data.settings,
      },
    });

    if (data.hotspots && Array.isArray(data.hotspots)) {
      await tx.hotspot.deleteMany({ where: { projectId: id } });

      for (const [index, hotspot] of data.hotspots.entries()) {
        const created = await tx.hotspot.create({
          data: {
            id: hotspot.id,
            projectId: id,
            x: hotspot.x,
            y: hotspot.y,
            color: hotspot.color || "#ef4444",
            icon: hotspot.icon || "pin",
            title: hotspot.title || "",
            orderNum: hotspot.orderNum ?? index,
          },
        });

        if (hotspot.audio) {
          const audio = await tx.audioClip.create({
            data: {
              id: hotspot.audio.id,
              hotspotId: created.id,
              audioUrl: hotspot.audio.audioUrl,
              duration: hotspot.audio.duration || 0,
            },
          });

          if (hotspot.audio.subtitles?.length) {
            await tx.subtitleSegment.createMany({
              data: hotspot.audio.subtitles.map((sub: {
                id: string;
                text: string;
                startTime: number;
                endTime: number;
              }) => ({
                id: sub.id,
                audioClipId: audio.id,
                text: sub.text,
                startTime: sub.startTime,
                endTime: sub.endTime,
              })),
            });
          }
        }
      }
    }
  });

  return NextResponse.json({ success: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
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

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.project.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

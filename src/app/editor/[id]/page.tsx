import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EditorClient } from "./editor-client";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(`/editor/${id}`)}`);

  // For "new", create a new project
  if (id === "new") {
    const draftProject = await prisma.project.findFirst({
      where: {
        userId: session.user.id!,
        coverImage: null,
        hotspots: {
          none: {},
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (draftProject) {
      redirect(`/editor/${draftProject.id}`);
    }

    const project = await prisma.project.create({
      data: {
        title: "未命名作品",
        userId: session.user.id!,
      },
    });
    redirect(`/editor/${project.id}`);
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      hotspots: {
        orderBy: { orderNum: "asc" },
        include: {
          audio: {
            include: {
              subtitles: {
                orderBy: { startTime: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    return <div className="p-8 text-center">这张卡不存在</div>;
  }

  if (project.userId !== session.user.id) {
    return <div className="p-8 text-center">无权访问这张卡</div>;
  }

  return <EditorClient project={JSON.parse(JSON.stringify(project))} />;
}

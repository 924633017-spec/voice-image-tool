"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProjectCardActionsProps = {
  projectId: string;
  title: string;
  canPlay: boolean;
};

export function ProjectCardActions({ projectId, title, canPlay }: ProjectCardActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete_failed");
      toast.success("已删除");
      router.refresh();
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={canPlay ? `/play/${projectId}` : `/editor/${projectId}`}
        className="ghost-button ghost-button-dark inline-flex rounded-full px-4 py-2 text-[11px] font-medium tracking-[0.16em] text-white/74 uppercase"
      >
        {canPlay ? "成品" : "继续"}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-white/74 hover:bg-white/[0.08] hover:text-white">
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="min-w-[148px] rounded-2xl border border-white/10 bg-black/90 p-1 text-white shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          <DropdownMenuItem className="rounded-xl px-3 py-2 text-white/86 focus:bg-white/[0.08] focus:text-white" asChild>
            <Link href={`/editor/${projectId}`}>继续制作</Link>
          </DropdownMenuItem>

          {canPlay && (
            <DropdownMenuItem className="rounded-xl px-3 py-2 text-white/86 focus:bg-white/[0.08] focus:text-white" asChild>
              <Link href={`/play/${projectId}`}>查看成品</Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            className="rounded-xl px-3 py-2 text-[#ffb3b3] focus:bg-[#6e1b1b]/35 focus:text-[#ffd4d4]"
            onClick={() => {
              if (confirm(`确定删除"${title}"？删除后无法恢复。`)) {
                handleDelete();
              }
            }}
          >
            <Trash2 className="size-3.5 mr-2" />
            删除作品
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

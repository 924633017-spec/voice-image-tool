"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;

    setDeleting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("delete_failed");
      }

      setOpen(false);
      toast.success("作品已删除");
      router.refresh();
    } catch {
      toast.error("删除失败，请稍后再试");
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full border border-white/8 bg-white/[0.04] text-white/74 hover:bg-white/[0.08] hover:text-white"
                aria-label={`打开${title}操作`}
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="min-w-[148px] rounded-2xl border border-white/10 bg-black/90 p-1 text-white shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <DropdownMenuItem
              className="rounded-xl px-3 py-2 text-white/86 focus:bg-white/[0.08] focus:text-white"
              render={<Link href={`/editor/${projectId}`} />}
            >
              继续制作
            </DropdownMenuItem>

            {canPlay && (
              <DropdownMenuItem
                className="rounded-xl px-3 py-2 text-white/86 focus:bg-white/[0.08] focus:text-white"
                render={<Link href={`/play/${projectId}`} />}
              >
                查看成品
              </DropdownMenuItem>
            )}

            <DialogTrigger
              nativeButton={false}
              render={
                <DropdownMenuItem
                  className="rounded-xl px-3 py-2 text-[#ffb3b3] focus:bg-[#6e1b1b]/35 focus:text-[#ffd4d4]"
                />
              }
            >
              <Trash2 className="size-3.5" />
              删除作品
            </DialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>

        <DialogContent className="max-w-[420px] rounded-[1.8rem] border border-white/10 bg-[#101010] p-0 text-white ring-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="display-title text-[1.6rem] leading-[0.92] text-white">
              删除这张作品？
            </DialogTitle>
            <DialogDescription className="pt-2 text-[13px] leading-6 text-white/54">
              <span className="text-white/78">“{title}”</span> 删除后将无法恢复，相关录音与字幕也会一起移除。
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-6 flex-row items-center justify-end gap-2 border-t border-white/8 bg-white/[0.02] px-6 py-5">
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 text-white/72 hover:bg-white/[0.08] hover:text-white"
                />
              }
            >
              取消
            </DialogClose>

            <Button
              variant="destructive"
              className="rounded-full px-4 text-[#ffd8d8] hover:text-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "删除中" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="site-shell flex min-h-screen items-center justify-center bg-black px-6 py-10">
      <div className="w-full max-w-[720px] rounded-[2.5rem] border border-white/8 bg-white/[0.04] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.24)]">
        <div className="rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-8 py-14 text-center backdrop-blur-xl sm:px-12 sm:py-16">
          <p className="eyebrow text-white/38">图述</p>
          <h1 className="display-title mt-5 text-[2.8rem] leading-[0.88] text-white sm:text-[4rem]">
            这张作品已经不在这里了
          </h1>
          <p className="mx-auto mt-5 max-w-[24rem] text-[14px] leading-7 text-white/50 sm:text-[15px]">
            可能已经被删除，或者这个链接已经失效。回到首页，重新开始一张新的作品卡。
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className="ghost-button ghost-button-dark rounded-full px-6 py-3 text-sm font-medium">
              回到首页
            </Link>
            <Link href="/editor/new" className="ghost-button rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white/82 hover:bg-white/[0.1]">
              开始制作
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

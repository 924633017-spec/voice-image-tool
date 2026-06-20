"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import seasideHero from "@/assets/demo-seaside-blue-horizontal-v4.webp";

const inputClass =
  "w-full rounded-[1.15rem] border border-white/10 bg-white/8 px-4 py-3.5 text-sm text-white outline-none transition-all duration-200 placeholder:text-white/30 focus:border-white/18 focus:bg-white/10";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const callbackUrl = searchParams.get("callbackUrl");
  const nextHref =
    callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/editor/new";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("邮箱或密码错误");
      setLoading(false);
      return;
    }

    router.push(nextHref);
    router.refresh();
  }

  return (
    <div className="site-shell site-grid min-h-screen px-4 py-5 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-7xl items-start sm:items-center">
        <section className="gallery-stage relative w-full overflow-hidden rounded-[2.2rem] border border-white/10">
          <div className="gallery-stage-backdrop">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={seasideHero.src} alt="登录背景" className="gallery-stage-image" />
          </div>

          <div className="gallery-stage-overlay" />

          <div className="relative z-10 grid min-h-[auto] gap-6 p-5 sm:min-h-[700px] sm:p-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,0.88fr)] lg:gap-8 lg:p-10">
            <div className="flex flex-col justify-between">
              <div>
                <Link href="/" className="text-lg font-semibold tracking-[-0.04em] text-white">
                  图述
                </Link>

                <p className="eyebrow mt-10 text-white/40 sm:mt-14">继续</p>
                <h1 className="display-title mt-4 max-w-[6.6em] whitespace-pre-line text-[2.6rem] leading-[0.88] text-white sm:mt-5 sm:text-[4rem] lg:text-[4.8rem]">
                  回来，
                  {"\n"}
                  接着把它说完
                </h1>
                <p className="mt-4 max-w-[19rem] text-[14px] leading-6 text-white/58 sm:mt-5 sm:text-[15px] sm:leading-7">
                  登录之后，会直接回到你的制作流程里，继续补图、录音和生成成品。
                </p>
              </div>

              <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-black/14 p-4 backdrop-blur-md sm:mt-0 sm:max-w-[24rem] sm:rounded-[1.6rem]">
                <p className="text-[11px] tracking-[0.18em] text-white/36 uppercase">你会继续</p>
                <div className="mt-3 space-y-2.5 text-[13px] text-white/56 sm:mt-4 sm:space-y-3 sm:text-sm sm:text-white/58">
                  <p>编辑作品主图</p>
                  <p>录下你自己的讲述</p>
                  <p>发出最终作品页</p>
                </div>
              </div>
            </div>

            <div className="flex items-start justify-end sm:items-center">
              <section className="w-full max-w-[460px] rounded-[1.6rem] border border-white/12 bg-[linear-gradient(180deg,rgba(8,8,8,0.62),rgba(8,8,8,0.4))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-[18px] sm:rounded-[1.9rem] sm:p-8">
                <p className="eyebrow text-white/34">账号</p>
                <h2 className="display-title mt-3 text-[2.2rem] leading-[0.92] text-white sm:mt-4 sm:text-[3.4rem]">
                  继续制作
                </h2>

                <form onSubmit={submit} className="mt-7 space-y-4 sm:mt-9">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold tracking-[0.18em] text-white/34 uppercase">
                      邮箱
                    </label>
                    <input name="email" type="email" required className={inputClass} placeholder="you@example.com" />
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-semibold tracking-[0.18em] text-white/34 uppercase">
                      密码
                    </label>
                    <input name="password" type="password" required className={inputClass} placeholder="输入你的密码" />
                  </div>

                  {error && <p className="text-xs font-medium text-[#ffb2bc]">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="ghost-button ghost-button-dark w-full rounded-full px-5 py-4 text-sm font-medium btn-press transition-opacity disabled:opacity-55"
                  >
                    {loading ? "登录中…" : "进入"}
                  </button>
                </form>

                <div className="mt-6 flex items-center justify-between rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4 sm:mt-8 sm:rounded-[1.4rem]">
                  <p className="text-sm text-white/46">还没有账号</p>
                  <Link
                    href={`/register?callbackUrl=${encodeURIComponent(nextHref)}`}
                    className="ghost-button ghost-button-dark rounded-full px-4 py-2 text-sm font-medium"
                  >
                    注册
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

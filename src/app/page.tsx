import Link from "next/link";
import { HomeGalleryStage } from "@/components/home-gallery-stage";
import { demoCategories } from "@/lib/demo-gallery";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  const startHref = session ? "/editor/new" : "/register?callbackUrl=%2Feditor%2Fnew";
  const loginHref = "/login?callbackUrl=%2Feditor%2Fnew";

  return (
    <div className="site-shell site-grid min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-white/8 bg-black/72 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-lg font-semibold tracking-[-0.04em] text-white">
            图述
          </Link>

          <div className="flex items-center gap-3">
            {session ? (
              <Link href="/dashboard" className="ghost-button ghost-button-dark rounded-full px-5 py-2.5 text-sm font-medium">
                作品
              </Link>
            ) : (
              <>
                <Link href={loginHref} className="px-4 py-2 text-sm font-medium text-white/68 transition-opacity hover:opacity-100">
                  登录
                </Link>
                <Link href={startHref} className="ghost-button ghost-button-dark rounded-full px-5 py-2.5 text-sm font-medium">
                  开始
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 sm:pb-20 sm:pt-8">
        <HomeGalleryStage categories={demoCategories} startHref={startHref} />
      </main>
    </div>
  );
}

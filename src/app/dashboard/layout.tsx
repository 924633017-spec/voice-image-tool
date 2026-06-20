import Link from "next/link";
import { getSession } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="site-shell min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/72 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/dashboard" className="text-lg font-semibold tracking-[-0.04em] text-white">
            图述
          </Link>

          <div className="flex items-center gap-3 text-sm text-white/46">
            <div className="hidden rounded-full border border-white/10 bg-white/6 px-4 py-2 sm:block">
              {session?.user?.email ?? "已登录用户"}
            </div>
            <Link href="/" className="ghost-button ghost-button-dark rounded-full px-4 py-2 text-sm font-medium">
              首页
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

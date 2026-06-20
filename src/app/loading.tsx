export default function AppLoading() {
  return (
    <div className="site-shell flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[720px] rounded-[2.4rem] border border-white/8 bg-white/5 p-4">
        <div className="rounded-[2rem] border border-black/[0.06] bg-[linear-gradient(180deg,#ffffff,#fbfbf9)] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.08)] sm:p-10">
          <div className="mx-auto max-w-[420px] text-center">
            <div className="mx-auto h-14 w-14 animate-pulse rounded-full border border-black/8 bg-black/[0.04]" />
            <div className="mx-auto mt-8 h-4 w-20 rounded-full bg-black/[0.05]" />
            <div className="mx-auto mt-4 h-10 w-56 rounded-full bg-black/[0.08]" />
            <div className="mx-auto mt-8 h-3 w-full rounded-full bg-black/[0.05]" />
            <div className="mx-auto mt-3 h-3 w-4/5 rounded-full bg-black/[0.04]" />
          </div>
        </div>
      </div>
    </div>
  );
}

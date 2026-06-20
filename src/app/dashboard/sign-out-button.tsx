"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      className="ghost-button rounded-full px-4 py-2 text-sm font-medium"
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      退出登录
    </button>
  );
}

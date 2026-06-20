"use server";

import { auth } from "@/lib/auth";

export async function getSession() {
  return await auth();
}

export async function getUserPlan(): Promise<string> {
  const session = await auth();
  if (!session?.user) return "free";

  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });

  return user?.plan ?? "free";
}

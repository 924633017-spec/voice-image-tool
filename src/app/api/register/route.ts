import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "邮箱和密码为必填项" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码至少 6 位" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "该邮箱已注册" },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 8);

    await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name || email.split("@")[0],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Registration error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `注册失败: ${message}` },
      { status: 500 }
    );
  }
}

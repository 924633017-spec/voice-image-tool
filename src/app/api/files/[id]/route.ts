import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const record = await prisma.storedFile.findUnique({ where: { id } });

    if (!record) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return new NextResponse(record.data, {
      headers: {
        "Content-Type": record.mimeType,
        "Content-Length": String(record.data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}

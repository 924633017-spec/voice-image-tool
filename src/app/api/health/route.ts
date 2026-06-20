import { NextResponse } from "next/server";
import { getDeployReadiness } from "@/lib/deploy-readiness";

export async function GET() {
  const readiness = getDeployReadiness();

  return NextResponse.json(
    {
      service: "图述",
      timestamp: new Date().toISOString(),
      ...readiness,
    },
    { status: readiness.ok ? 200 : 503 },
  );
}


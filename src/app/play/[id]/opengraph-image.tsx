import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlayOpenGraphImage({ params }: Props) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      hotspots: {
        include: {
          audio: true,
        },
      },
    },
  });

  const title = project?.title ?? "图述";
  const totalHotspots = project?.hotspots.length ?? 0;
  const playableCount = project?.hotspots.filter((hotspot) => hotspot.audio).length ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "space-between",
          padding: "46px",
          background:
            "radial-gradient(circle at top, rgba(255,255,255,0.06), transparent 16%), linear-gradient(180deg, #070707 0%, #0b0b0a 100%)",
          color: "#fff7ef",
          fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 18,
            borderRadius: 42,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 670 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 76,
                lineHeight: 0.9,
                letterSpacing: "-0.08em",
                fontWeight: 700,
                maxWidth: 620,
              }}
            >
              <span>{title}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 28, lineHeight: 1.5, color: "rgba(255,255,255,0.62)", maxWidth: 620 }}>
              <span>这张作品，</span>
              <span>可以被亲口讲述。</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 18 }}>
            {[
              { label: "讲述点位", value: String(totalHotspots).padStart(2, "0") },
              { label: "可播放", value: String(playableCount).padStart(2, "0") },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: "22px 24px",
                  borderRadius: 24,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    minWidth: 150,
                }}
              >
                <span style={{ fontSize: 18, color: "rgba(255,255,255,0.42)" }}>{item.label}</span>
                <span style={{ fontSize: 40, fontWeight: 700 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            width: 348,
            height: 538,
            borderRadius: 38,
            padding: 18,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 40px 120px rgba(0,0,0,0.28)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              flex: 1,
              borderRadius: 30,
              background: "linear-gradient(180deg, #f8f7f3 0%, #ece7dd 100%)",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%,-50%)",
                width: 94,
                height: 94,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.95)",
                background: "rgba(255,255,255,0.95)",
                boxShadow: "0 26px 58px rgba(0,0,0,0.16)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  marginLeft: 8,
                  width: 0,
                  height: 0,
                  borderTop: "16px solid transparent",
                  borderBottom: "16px solid transparent",
                  borderLeft: "24px solid #181816",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              borderRadius: 26,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: 18,
            }}
          >
            <div style={{ height: 3, width: 132, borderRadius: 999, background: "rgba(255,255,255,0.72)" }} />
            <div style={{ display: "flex", flexDirection: "column", fontSize: 28, lineHeight: 1.45, color: "#fffaf4" }}>
              <span>点开就播</span>
              <span>实时字幕</span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}

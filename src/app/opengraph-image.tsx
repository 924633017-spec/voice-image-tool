import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background:
            "radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 30%), radial-gradient(circle at 82% 18%, rgba(170,45,54,0.16), transparent 20%), linear-gradient(180deg, #f7f1e8 0%, #efe2cd 100%)",
          color: "#1c1712",
          fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 56,
            top: 56,
            width: 340,
            height: 450,
            borderRadius: 36,
            background:
              "radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 26%), linear-gradient(180deg, rgba(34,26,20,0.98), rgba(18,14,11,0.98))",
            border: "1px solid rgba(28,23,18,0.08)",
            boxShadow: "0 40px 120px rgba(36, 23, 11, 0.18)",
            overflow: "hidden",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 220,
              height: 300,
              borderRadius: 24,
              background: "linear-gradient(180deg, #6a5947 0%, #30261e 100%)",
              marginBottom: 48,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 40,
                top: 170,
                width: 44,
                height: 44,
                borderRadius: 999,
                border: "3px solid rgba(255,255,255,0.95)",
                background: "#c94651",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 22,
              }}
            >
              ▶
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 680 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, color: "#54483d", letterSpacing: "0.18em" }}>
            <span>图述</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 84,
              lineHeight: 0.92,
              letterSpacing: "-0.08em",
              fontWeight: 700,
            }}
          >
            <span>让作品，</span>
            <span>自己被讲述</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 28, lineHeight: 1.5, color: "#5f5347", maxWidth: 620 }}>
            <span>把图片、声音和字幕，</span>
            <span>收成一张可以点开聆听的卡。</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 22, color: "#6f6153" }}>
          <span>选图</span>
          <span>·</span>
          <span>录音</span>
          <span>·</span>
          <span>分享</span>
        </div>
      </div>
    ),
    size,
  );
}

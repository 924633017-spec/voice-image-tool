import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at top, rgba(255,255,255,0.22), transparent 32%), linear-gradient(180deg, #231913 0%, #120d09 100%)",
          color: "#fff7ef",
          position: "relative",
          fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 26,
            borderRadius: 80,
            border: "2px solid rgba(255,255,255,0.12)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 140,
            height: 140,
            borderRadius: 999,
            background: "rgba(170,45,54,0.18)",
            filter: "blur(18px)",
            left: 70,
            bottom: 78,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 178,
            fontWeight: 700,
            letterSpacing: "-0.08em",
            color: "#f8eee4",
            fontFamily: '"Songti SC", "STSong", serif',
          }}
        >
          <span>述</span>
        </div>
      </div>
    ),
    size,
  );
}

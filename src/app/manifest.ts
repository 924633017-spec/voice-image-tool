import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "图述",
    short_name: "图述",
    description: "为你的作品发声。",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f3",
    theme_color: "#050505",
    lang: "zh-CN",
  };
}

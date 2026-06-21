import seasideHero from "@/assets/demo-seaside-blue-horizontal-v4.webp";
import blessingHero from "@/assets/demo-blessing-premium-v1.webp";
import musicHero from "@/assets/demo-music-premium-v1.webp";
import showcaseHero from "@/assets/demo-showcase-premium-v1.webp";

export type DemoCategory = {
  id: string;
  label: string;
  title: string;
  caption: string;
  tone: string;
  image: string;
  heroTitle: string;
  heroBody: string;
};

export const demoCategories: DemoCategory[] = [
  {
    id: "photo",
    label: "摄影记录",
    title: "拍下的那一刻，把想法也留在画面里。",
    caption: "光影，构图，瞬间",
    tone: "from-white/18 via-white/8 to-white/[0.04]",
    image: seasideHero.src,
    heroTitle: "定格光影，\n留声记录",
    heroBody: "每一次快门的理由，用声音标注在作品上。",
  },
  {
    id: "process",
    label: "创意过程",
    title: "半成品也有话要说，录下此刻的思考。",
    caption: "草图，迭代，推敲",
    tone: "from-[#91a7ff]/28 via-[#7d8ef5]/14 to-white/[0.03]",
    image: musicHero.src,
    heroTitle: "过程的每一步，\n都值得被听见",
    heroBody: "设计稿、草稿、原型，把思路录在上面，回头看全是成长。",
  },
  {
    id: "inspiration",
    label: "作品灵感",
    title: "让作品自己开口，把创作背后的故事讲出来。",
    caption: "灵感，表达，呈现",
    tone: "from-[#f4d9b8]/22 via-white/10 to-white/[0.03]",
    image: showcaseHero.src,
    heroTitle: "作品不只是画面，\n还有背后的声音",
    heroBody: "海报、插画、摄影、空间，每一件作品都值得一段亲口讲述。",
  },
  {
    id: "explain",
    label: "作品讲解",
    title: "在作品上直接标注讲解，一目了然。",
    caption: "讲解，标注，传达",
    tone: "from-[#f7c9d7]/22 via-white/10 to-white/[0.03]",
    image: blessingHero.src,
    heroTitle: "每一处细节，\n都亲口讲清楚",
    heroBody: "不用再打一堆文字说明，在图上直接录音标注，对方点开就懂。",
  },
];

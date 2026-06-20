import seasideHero from "@/assets/demo-seaside-blue-horizontal-v4.png";
import blessingHero from "@/assets/demo-blessing-premium-v1.png";
import musicHero from "@/assets/demo-music-premium-v1.png";
import showcaseHero from "@/assets/demo-showcase-premium-v1.png";

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
    label: "高级摄影",
    title: "把这一幕，连同你的声音一起发出去。",
    caption: "风景，人像，纪实",
    tone: "from-white/18 via-white/8 to-white/[0.04]",
    image: seasideHero.src,
    heroTitle: "让这一幕，\n带着你的声音",
    heroBody: "拍到一张好图时，也把当下那句话一起留进去。",
  },
  {
    id: "music",
    label: "音乐界面",
    title: "让封面先出现，再让声音慢慢进来。",
    caption: "封面，旋律，氛围",
    tone: "from-[#91a7ff]/28 via-[#7d8ef5]/14 to-white/[0.03]",
    image: musicHero.src,
    heroTitle: "像一张封面，\n轻轻一点就能听",
    heroBody: "把旋律、氛围和一句话，藏进一张足够好看的封面里。",
  },
  {
    id: "showcase",
    label: "作品展示",
    title: "把作品的想法，直接讲在作品上。",
    caption: "创意，过程，表达",
    tone: "from-[#f4d9b8]/22 via-white/10 to-white/[0.03]",
    image: showcaseHero.src,
    heroTitle: "让作品自己，\n把想法说出来",
    heroBody: "设计稿、海报、空间、模型，都可以变成一张会讲述的作品卡。",
  },
  {
    id: "blessing",
    label: "祝福",
    title: "一张图，一句亲口说出的心意。",
    caption: "生日，纪念，问候",
    tone: "from-[#f7c9d7]/22 via-white/10 to-white/[0.03]",
    image: blessingHero.src,
    heroTitle: "把一句祝福，\n留在画面里",
    heroBody: "生日、纪念、问候，不只是发字，也可以把声音亲口留进去。",
  },
];

import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { getSiteUrl } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: "图述 | 为你的作品发声",
  description: "把图片、本人录音和实时字幕，收成一张可以直接分享的作品卡。",
  applicationName: "图述",
  keywords: ["图述", "声音卡", "图片讲述", "实时字幕", "语音分享", "图片配音"],
  authors: [{ name: "图述" }],
  creator: "图述",
  publisher: "图述",
  metadataBase: new URL(getSiteUrl()),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "图述 | 为你的作品发声",
    description: "把图片、本人录音和实时字幕，收成一张可以直接分享的作品卡。",
    type: "website",
    locale: "zh_CN",
    siteName: "图述",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "图述",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "图述 | 为你的作品发声",
    description: "把图片、本人录音和实时字幕，收成一张可以直接分享的作品卡。",
    images: ["/opengraph-image"],
  },
  category: "productivity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`,
          }}
        />
      </body>
    </html>
  );
}

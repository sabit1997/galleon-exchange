import type { Metadata, Viewport } from "next";
import { Cinzel, Gowun_Batang } from "next/font/google";
import { Gate } from "@/components/layout/gate";
import { Header } from "@/components/layout/header";
import { SessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

// 한글 글리프는 unicode-range 로 필요할 때 받아 오므로 latin 만 미리 불러온다
const gowun = Gowun_Batang({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-gowun",
  display: "swap",
});

export const metadata: Metadata = {
  title: "갈레온 증권 · 카르텔 마법학교",
  description: "카르텔 마법학교 친구들의 공부 주식시장",
};

export const viewport: Viewport = {
  themeColor: "#120e0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${cinzel.variable} ${gowun.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SessionProvider>
          <Gate header={<Header />}>{children}</Gate>
        </SessionProvider>
      </body>
    </html>
  );
}

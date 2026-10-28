import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Gate } from "@/components/layout/gate";
import { Header } from "@/components/layout/header";
import { SessionProvider } from "@/components/providers/session-provider";
// 한글은 프리텐다드(동적 서브셋 — 화면에 쓰인 글자 묶음만 받아 온다), 영문·숫자는 Geist.
// 둘 다 패키지에 들어 있는 로컬 파일이라 빌드할 때 네트워크가 필요 없다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "갈레온 증권 · 카르텔 마법학교",
  description: "카르텔 마법학교 친구들의 공부 주식시장",
};

export const viewport: Viewport = {
  themeColor: "#070815",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${GeistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SessionProvider>
          <Gate header={<Header />}>{children}</Gate>
        </SessionProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Gate } from "@/components/layout/gate";
import { Header } from "@/components/layout/header";
import { SessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "갈레온 증권 · 카르텔 마법학교",
  description: "카르텔 마법학교 친구들의 공부 주식시장",
};

export const viewport: Viewport = {
  themeColor: "#0b0a1a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <SessionProvider>
          <Gate header={<Header />}>{children}</Gate>
        </SessionProvider>
      </body>
    </html>
  );
}

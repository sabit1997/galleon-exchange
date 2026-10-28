import type { Metadata } from "next";
import { LearnGuide } from "@/components/learn/learn-guide";

export const metadata: Metadata = {
  title: "주식 공부 · 갈레온 증권",
  description: "갈레온 증권으로 배우는 주식 용어와 실제 주식시장 규칙",
};

export default function LearnPage() {
  return <LearnGuide />;
}

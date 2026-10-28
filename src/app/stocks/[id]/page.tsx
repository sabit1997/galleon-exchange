import { Suspense } from "react";
import { StockDetail } from "@/components/market/stock-detail";
import { Spinner } from "@/components/ui/card";

export default function StockPage() {
  // useParams 는 빌드 시 알 수 없는 동적 경로에서 suspend 한다 (cacheComponents)
  return (
    <Suspense fallback={<Spinner />}>
      <StockDetail />
    </Suspense>
  );
}

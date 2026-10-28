import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/** 디스코드 OAuth 콜백: code 를 세션 쿠키로 바꾸고 원래 페이지로 보낸다. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  // 오픈 리다이렉트 방지: 같은 사이트 경로만 허용
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code) {
    const supabase = await getServerSupabase();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, origin));
    }
  }
  return NextResponse.redirect(new URL("/?auth_error=1", origin));
}

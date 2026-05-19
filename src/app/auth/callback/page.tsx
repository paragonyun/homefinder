"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSafeAuthRedirectPath } from "@/lib/auth/redirect-url";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("로그인 상태를 확인하는 중입니다.");

  useEffect(() => {
    let isMounted = true;

    async function completeLogin() {
      const supabase = createSupabaseBrowserClient();

      if (!supabase) {
        setMessage("Supabase 환경변수가 설정되지 않았습니다.");
        return;
      }

      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get("code");
      const nextPath = getSafeAuthRedirectPath(currentUrl.searchParams.get("next"));

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setMessage(`로그인 처리에 실패했습니다: ${error.message}`);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (session) {
        router.replace(nextPath);
        return;
      }

      setMessage("로그인 세션을 찾지 못했습니다. 이메일 링크를 다시 요청해 주세요.");
    }

    completeLogin();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <AppShell>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
          로그인 확인
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
      </section>
    </AppShell>
  );
}

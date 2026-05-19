"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getAuthCallbackUrl } from "@/lib/auth/redirect-url";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export function AuthPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    setIsPending(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getAuthCallbackUrl(window.location.origin, "/settings"),
      },
    });

    setIsPending(false);
    setMessage(
      error ? error.message : "로그인 링크를 이메일로 보냈습니다.",
    );
  }

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setMessage("로그아웃했습니다.");
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Supabase 환경변수가 아직 없어 placeholder 모드입니다. Vercel에
        `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 넣으면
        로그인과 CRUD가 활성화됩니다.
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
        <p>
          로그인됨:{" "}
          <span className="font-semibold">{session.user.email}</span>
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="w-fit rounded-md border border-emerald-700 px-3 py-2 font-semibold text-emerald-900"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleLogin}
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto]"
    >
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        이메일 로그인
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          required
          placeholder="you@example.com"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
      >
        {isPending ? "전송 중" : "Magic link 전송"}
      </button>
      {message ? (
        <p className="text-sm text-slate-600 sm:col-span-2">{message}</p>
      ) : null}
    </form>
  );
}

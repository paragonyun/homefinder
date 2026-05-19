"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export function AuthPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  async function handlePasswordLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    setIsPending(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsPending(false);
    setMessage(error ? error.message : null);
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
    const role = getRoleFromAppMetadata(session.user.app_metadata);

    return (
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p>
            로그인됨:{" "}
            <span className="font-semibold">{session.user.email}</span>
          </p>
          <p className="mt-1 text-emerald-900">
            {isAdminRole(role)
              ? "운영자 권한으로 동네와 단지를 관리할 수 있습니다."
              : "읽기 전용 계정입니다. 동네와 단지 관리는 운영자만 가능합니다."}
          </p>
        </div>
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
      onSubmit={handlePasswordLogin}
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
    >
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        이메일
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          required
          placeholder="you@example.com"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        비밀번호
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400 sm:col-span-2"
      >
        {isPending ? "로그인 중" : "로그인"}
      </button>
      {message ? (
        <p className="text-sm text-slate-600 sm:col-span-2">{message}</p>
      ) : null}
    </form>
  );
}

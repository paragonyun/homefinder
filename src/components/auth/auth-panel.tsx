"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { formatLoginErrorMessage } from "@/lib/auth/login-error";
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

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setMessage(error ? formatLoginErrorMessage(error) : null);
    } catch (error) {
      setMessage(formatLoginErrorMessage(error));
    } finally {
      setIsPending(false);
    }
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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 shadow-sm">
        로그인 구성이 아직 연결되지 않았습니다. Supabase 공개 URL과 anon key를
        설정하면 개인 포트폴리오와 편집 기능을 사용할 수 있습니다.
      </div>
    );
  }

  if (session) {
    const role = getRoleFromAppMetadata(session.user.app_metadata);

    return (
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate">
            <span className="font-semibold text-slate-950">로그인</span>{" "}
            {session.user.email}
          </p>
          <p className="mt-1 text-slate-500">
            {isAdminRole(role)
              ? "운영자 권한으로 동네와 단지를 관리할 수 있습니다."
              : "읽기 전용 계정입니다. 동네와 단지 관리는 운영자만 가능합니다."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-fit rounded-md border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handlePasswordLogin}
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <p className="text-sm font-semibold text-slate-950">운영자 로그인</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          저장된 관심 단지와 임장 기록을 관리하려면 로그인하세요.
        </p>
      </div>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        이메일
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          required
          placeholder="you@example.com"
          className="rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
          className="rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-400 sm:col-span-2 sm:w-fit"
      >
        {isPending ? "로그인 중" : "로그인"}
      </button>
      {message ? (
        <p className="text-sm text-slate-600 sm:col-span-2">{message}</p>
      ) : null}
    </form>
  );
}

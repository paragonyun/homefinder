import { AppShell } from "@/components/layout/app-shell";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function SettingsPage() {
  return (
    <AppShell>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
          설정
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          API 키와 Supabase 연결은 서버 환경변수로 관리합니다. 외부 API 키는
          클라이언트에 노출하지 않는 것이 원칙입니다.
        </p>

        <div className="mt-6 grid gap-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">Supabase Auth</p>
            <p className="mt-1 text-sm text-slate-600">
              {isSupabaseConfigured
                ? "NEXT_PUBLIC_SUPABASE_URL과 ANON_KEY가 설정되어 있습니다."
                : "환경변수가 없어 placeholder 모드로 표시 중입니다."}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">외부 데이터</p>
            <p className="mt-1 text-sm text-slate-600">
              국토부, K-apt, NEIS, Kakao, 교통 API는 서버 route 또는 batch에서만
              호출합니다.
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

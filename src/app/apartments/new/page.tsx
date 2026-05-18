import { AppShell } from "@/components/layout/app-shell";

export default function NewApartmentPage() {
  return (
    <AppShell>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
          관심 단지 추가
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          이 화면은 단지명 검색, 주소 후보 선택, 좌표 확인, K-apt 코드 매칭
          상태를 연결하기 전의 placeholder입니다. 외부 API 키가 없어도 앱이
          깨지지 않는 구조를 우선 확인합니다.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            단지명
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-slate-500"
              placeholder="예: 래미안에스티움"
              disabled
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            연결할 동네
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-slate-500"
              placeholder="예: 신길동"
              disabled
            />
          </label>
        </div>

        <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          주소 후보, 법정동코드, 위도/경도, K-apt 코드, KB부동산 참고 링크,
          네이버부동산 참고 링크를 수동 보정 가능하게 둘 예정입니다.
        </div>
      </section>
    </AppShell>
  );
}

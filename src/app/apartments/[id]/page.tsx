import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StatusPill } from "@/components/ui/status-pill";
import { apartments } from "@/lib/mock-data";

export default async function ApartmentDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const apartment = apartments.find((item) => item.id === id);

  if (!apartment) {
    notFound();
  }

  const sections = [
    ["가격/실거래가", "국토부 실거래가 adapter 연결 후 평형대별 테이블과 차트를 표시합니다."],
    ["단지 기본정보", "K-apt 매칭 후 세대수, 동수, 사용승인일, 난방, 주차 정보를 표시합니다."],
    ["건축정보", "건축물대장 후보 데이터가 확보되면 용적률, 건폐율, 대지면적을 표시합니다."],
    ["학군", "NEIS 학교기본정보와 거리 계산을 MVP 2에서 연결합니다."],
    ["접근성", "여의도역/강남역과 커스텀 목적지 소요시간을 표시합니다."],
    ["임장 후기", "모바일 입력 화면과 사진 업로드를 연결합니다."],
    ["내 판단", "관심/보류/제외 상태와 추가 확인사항을 남깁니다."],
    ["데이터 출처", "source, fetched_at, confidence_level을 함께 표시합니다."],
  ];

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
                {apartment.name}
              </h1>
              <p className="mt-2 text-sm text-slate-600">{apartment.address}</p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
                {apartment.note}
              </p>
            </div>
            <StatusPill status={apartment.status} />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {sections.map(([title, body]) => (
            <article
              key={title}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </section>

        <Link
          href={`/field-notes/${apartment.id}`}
          className="w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
        >
          임장 메모 placeholder 열기
        </Link>
      </div>
    </AppShell>
  );
}

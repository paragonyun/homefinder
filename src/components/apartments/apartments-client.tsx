"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ApartmentRow } from "@/components/apartments/apartment-row";
import { AuthPanel } from "@/components/auth/auth-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import { apartments as mockApartments } from "@/lib/mock-data";
import {
  apartmentStatusValues,
  validateCommuteTimeInput,
  validateApartmentInput,
} from "@/lib/forms/home-data";
import {
  buildCommuteAccessSummaryByApartment,
  type CommuteAccessSummary,
  type CommuteSummary,
} from "@/lib/services/commute-summary";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type {
  ApartmentAliasRow,
  ApartmentRowData,
  CommuteTimeRow,
  NeighborhoodRow,
} from "@/lib/supabase/table-types";
import { statusLabels } from "@/lib/mock-data";

type ApartmentFormState = {
  id: string | null;
  name: string;
  neighborhoodId: string;
  address: string;
  roadAddress: string;
  lawdCd: string;
  kaptCode: string;
  status: string;
  memo: string;
  molitAliases: string;
  kbUrl: string;
  naverLandUrl: string;
  yeouidoDurationMinutes: string;
  yeouidoTransferCount: string;
  gangnamDurationMinutes: string;
  gangnamTransferCount: string;
};

const emptyForm: ApartmentFormState = {
  id: null,
  name: "",
  neighborhoodId: "",
  address: "",
  roadAddress: "",
  lawdCd: "",
  kaptCode: "",
  status: "candidate",
  memo: "",
  molitAliases: "",
  kbUrl: "",
  naverLandUrl: "",
  yeouidoDurationMinutes: "",
  yeouidoTransferCount: "",
  gangnamDurationMinutes: "",
  gangnamTransferCount: "",
};

function parseAliasInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function ApartmentsClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [apartments, setApartments] = useState<ApartmentRowData[]>([]);
  const [aliases, setAliases] = useState<ApartmentAliasRow[]>([]);
  const [commuteTimes, setCommuteTimes] = useState<CommuteTimeRow[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodRow[]>([]);
  const [form, setForm] = useState<ApartmentFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();
  const isAdmin = isAdminRole(getRoleFromAppMetadata(session?.user.app_metadata));

  const loadData = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setIsLoading(true);

    const [
      { data: apartmentRows, error: apartmentError },
      { data: neighborhoodRows },
      { data: aliasRows, error: aliasError },
      { data: commuteRows, error: commuteError },
    ] = await Promise.all([
        supabase
          .from("apartments")
          .select("*")
          .order("updated_at", { ascending: false }),
        supabase.from("neighborhoods").select("*").order("name"),
        supabase
          .from("apartment_aliases")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("commute_times")
          .select("*")
          .order("fetched_at", { ascending: false }),
      ]);

    if (apartmentError) {
      setMessage(apartmentError.message);
    } else {
      setApartments((apartmentRows ?? []) as ApartmentRowData[]);
      setNeighborhoods((neighborhoodRows ?? []) as NeighborhoodRow[]);
      setAliases(
        aliasError?.code === "42P01" ? [] : ((aliasRows ?? []) as ApartmentAliasRow[]),
      );
      setCommuteTimes(
        isMissingTableError(commuteError)
          ? []
          : ((commuteRows ?? []) as CommuteTimeRow[]),
      );

      if (aliasError && aliasError.code !== "42P01") {
        setMessage(aliasError.message);
      }

      if (commuteError && !isMissingTableError(commuteError)) {
        setMessage(commuteError.message);
      }
    }

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);

      if (data.session) {
        void loadData();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession) {
        void loadData();
      } else {
        setApartments([]);
        setAliases([]);
        setCommuteTimes([]);
        setNeighborhoods([]);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadData, supabase]);

  const rows = useMemo(() => {
    const commuteByApartmentId = buildCommuteAccessSummaryByApartment(commuteTimes);

    if (!session) {
      return mockApartments;
    }

    return apartments.map((apartment) => ({
      id: apartment.id,
      name: apartment.display_name ?? apartment.name,
      neighborhood:
        neighborhoods.find((item) => item.id === apartment.neighborhood_id)
          ?.name ?? "미지정",
      status: apartment.status,
      address: apartment.address ?? "주소 미입력",
      latestPrice: "실거래가 연동 전",
      areaSummary: "평형대 계산 전",
      accessSummary: formatCommuteListSummary(
        commuteByApartmentId.get(apartment.id) ?? null,
      ),
      sourceState: [
        apartment.lawd_cd ? `법정동코드 ${apartment.lawd_cd}` : "법정동코드 필요",
        apartment.kapt_code ? `K-apt ${apartment.kapt_code}` : "K-apt 코드 필요",
      ].join(" / "),
      note: apartment.memo ?? "메모 없음",
    }));
  }, [apartments, commuteTimes, neighborhoods, session]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !session || !isAdmin) {
      setMessage("단지 관리는 운영자 계정만 가능합니다.");
      return;
    }

    const validated = validateApartmentInput(form);

    if (!validated.ok) {
      setMessage(validated.error);
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const query = form.id
      ? supabase
          .from("apartments")
          .update(validated.value)
          .eq("id", form.id)
          .select("id")
          .single()
      : supabase.from("apartments").insert(validated.value).select("id").single();

    const { data: savedApartment, error } = await query;

    if (error) {
      setMessage(error.message);
    } else {
      const aliasError = await saveMolitAliases(savedApartment.id);

      if (aliasError) {
        setMessage(aliasError);
        setIsLoading(false);
        return;
      }

      const commuteError = await saveCommuteTimes(savedApartment.id);

      if (commuteError) {
        setMessage(commuteError);
        setIsLoading(false);
        return;
      }

      setForm(emptyForm);
      await loadData();
      setMessage(form.id ? "단지를 수정했습니다." : "단지를 추가했습니다.");
    }

    setIsLoading(false);
  }

  async function saveMolitAliases(apartmentId: string) {
    if (!supabase || !session) {
      return null;
    }

    const nextAliases = parseAliasInput(form.molitAliases);
    const { error: deleteError } = await supabase
      .from("apartment_aliases")
      .delete()
      .eq("apartment_id", apartmentId)
      .eq("source", "molit");

    if (deleteError) {
      return deleteError.message;
    }

    if (nextAliases.length === 0) {
      return null;
    }

    const { error: insertError } = await supabase.from("apartment_aliases").insert(
      nextAliases.map((alias) => ({
        apartment_id: apartmentId,
        user_id: session.user.id,
        alias,
        source: "molit",
      })),
    );

    return insertError?.message ?? null;
  }

  async function saveCommuteTimes(apartmentId: string) {
    if (!supabase || !session) {
      return null;
    }

    const inputs = [
      {
        apartmentId,
        destinationKey: "yeouido_station",
        durationMinutes: form.yeouidoDurationMinutes,
        transferCount: form.yeouidoTransferCount,
      },
      {
        apartmentId,
        destinationKey: "gangnam_station",
        durationMinutes: form.gangnamDurationMinutes,
        transferCount: form.gangnamTransferCount,
      },
    ];
    const payloads = [];

    for (const input of inputs) {
      const validated = validateCommuteTimeInput(input);

      if (!validated.ok) {
        return validated.error;
      }

      if (validated.value) {
        payloads.push({
          ...validated.value,
          user_id: session.user.id,
        });
      }
    }

    const hasExistingCommute = commuteTimes.some(
      (commuteTime) => commuteTime.apartment_id === apartmentId,
    );

    if (payloads.length === 0 && !hasExistingCommute) {
      return null;
    }

    const { error: deleteError } = await supabase
      .from("commute_times")
      .delete()
      .eq("apartment_id", apartmentId)
      .eq("transport_type", "transit")
      .in("destination_key", ["yeouido_station", "gangnam_station"]);

    if (deleteError) {
      return isMissingTableError(deleteError)
        ? "접근성 저장을 위해 commute_times migration을 먼저 적용하세요."
        : deleteError.message;
    }

    if (payloads.length === 0) {
      return null;
    }

    const { error: insertError } = await supabase
      .from("commute_times")
      .insert(payloads);

    return insertError
      ? isMissingTableError(insertError)
        ? "접근성 저장을 위해 commute_times migration을 먼저 적용하세요."
        : insertError.message
      : null;
  }

  async function handleDelete(id: string) {
    if (!supabase || !session || !isAdmin) {
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.from("apartments").delete().eq("id", id);

    if (error) {
      setMessage(error.message);
    } else {
      await loadData();
      setMessage("단지를 삭제했습니다.");
    }

    setIsLoading(false);
  }

  function startEdit(apartment: ApartmentRowData) {
    setForm({
      id: apartment.id,
      name: apartment.name,
      neighborhoodId: apartment.neighborhood_id ?? "",
      address: apartment.address ?? "",
      roadAddress: apartment.road_address ?? "",
      lawdCd: apartment.lawd_cd ?? "",
      kaptCode: apartment.kapt_code ?? "",
      status: apartment.status,
      memo: apartment.memo ?? "",
      molitAliases: aliases
        .filter((alias) => alias.apartment_id === apartment.id)
        .filter((alias) => !alias.source || alias.source === "molit")
        .map((alias) => alias.alias)
        .join("\n"),
      kbUrl: apartment.kb_url ?? "",
      naverLandUrl: apartment.naver_land_url ?? "",
      yeouidoDurationMinutes: getCommuteFormValue(
        apartment.id,
        "yeouido_station",
        "duration",
      ),
      yeouidoTransferCount: getCommuteFormValue(
        apartment.id,
        "yeouido_station",
        "transfer",
      ),
      gangnamDurationMinutes: getCommuteFormValue(
        apartment.id,
        "gangnam_station",
        "duration",
      ),
      gangnamTransferCount: getCommuteFormValue(
        apartment.id,
        "gangnam_station",
        "transfer",
      ),
    });
  }

  function getCommuteFormValue(
    apartmentId: string,
    destinationKey: "yeouido_station" | "gangnam_station",
    field: "duration" | "transfer",
  ) {
    const commuteTime = commuteTimes.find(
      (item) =>
        item.apartment_id === apartmentId &&
        item.destination_key === destinationKey &&
        item.transport_type === "transit",
    );
    const value =
      field === "duration"
        ? commuteTime?.duration_minutes
        : commuteTime?.transfer_count;

    return value !== null && value !== undefined ? String(value) : "";
  }

  return (
    <div className="grid gap-5">
      <AuthPanel />

      {session && isAdmin ? (
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {form.id ? "단지 수정" : "단지 추가"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              가격 데이터는 수동 입력하지 않고 공식 API 연동 전까지 메모와
              매칭값만 관리합니다.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              단지명
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="예: 래미안에스티움"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              동네
              <select
                value={form.neighborhoodId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    neighborhoodId: event.target.value,
                  }))
                }
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">미지정</option>
                {neighborhoods.map((neighborhood) => (
                  <option key={neighborhood.id} value={neighborhood.id}>
                    {neighborhood.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              상태
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                {apartmentStatusValues.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              주소
              <input
                value={form.address}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="예: 서울 영등포구 신길동"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              법정동코드
              <input
                value={form.lawdCd}
                onChange={(event) =>
                  setForm((current) => ({ ...current, lawdCd: event.target.value }))
                }
                inputMode="numeric"
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="예: 11560 또는 1156013200"
              />
              <span className="text-xs leading-5 text-slate-500">
                5자리 시군구 코드 또는 10자리 법정동코드를 입력할 수 있습니다.
                국토부 조회에는 앞 5자리만 사용합니다.
              </span>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              K-apt 코드
              <input
                value={form.kaptCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    kaptCode: event.target.value,
                  }))
                }
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="예: A15876402"
              />
              <span className="text-xs leading-5 text-slate-500">
                K-apt 기본정보 동기화에 사용할 단지 코드를 수동으로 입력합니다.
              </span>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              KB부동산 참고 링크
              <input
                value={form.kbUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, kbUrl: event.target.value }))
                }
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="자동 수집이 아닌 참고 링크"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              네이버부동산 참고 링크
              <input
                value={form.naverLandUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    naverLandUrl: event.target.value,
                  }))
                }
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="자동 수집이 아닌 참고 링크"
              />
            </label>
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  강남역/여의도역 접근성
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  현재는 지도 API 자동계산 전 단계입니다. 네이버지도/카카오맵 등에서
                  확인한 대중교통 기준 시간을 수동 기록합니다.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <CommuteInputs
                  title="여의도역"
                  durationValue={form.yeouidoDurationMinutes}
                  transferValue={form.yeouidoTransferCount}
                  onDurationChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      yeouidoDurationMinutes: value,
                    }))
                  }
                  onTransferChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      yeouidoTransferCount: value,
                    }))
                  }
                />
                <CommuteInputs
                  title="강남역"
                  durationValue={form.gangnamDurationMinutes}
                  transferValue={form.gangnamTransferCount}
                  onDurationChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      gangnamDurationMinutes: value,
                    }))
                  }
                  onTransferChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      gangnamTransferCount: value,
                    }))
                  }
                />
              </div>
            </div>
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              메모
              <textarea
                value={form.memo}
                onChange={(event) =>
                  setForm((current) => ({ ...current, memo: event.target.value }))
                }
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                placeholder="확인할 점, 임장 포인트, 판단 메모"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              국토부 원천 단지명 alias
              <textarea
                value={form.molitAliases}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    molitAliases: event.target.value,
                  }))
                }
                className="min-h-20 rounded-md border border-slate-300 px-3 py-2"
                placeholder={"예: 관악드림(동아)\n관악드림(삼성)"}
              />
              <span className="text-xs leading-5 text-slate-500">
                국토부 실거래가 원천명과 등록 단지명이 다를 때만 입력합니다. 여러
                개는 줄바꿈 또는 쉼표로 구분합니다.
              </span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
            >
              {form.id ? "수정" : "추가"}
            </button>
            {form.id ? (
              <button
                type="button"
                onClick={() => setForm(emptyForm)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                취소
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {message ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </p>
      ) : null}

      {!isSupabaseConfigured || !session ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
          현재는 예시 데이터가 표시됩니다. 운영자 계정으로 로그인하면 Supabase의
          실제 관심 단지 목록을 추가/수정/삭제할 수 있습니다.
        </p>
      ) : null}

      {session && !isAdmin ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
          읽기 전용 계정입니다. 관심 단지 추가, 수정, 삭제는 운영자만 가능합니다.
        </p>
      ) : null}

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full min-w-[960px] text-left">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">단지</th>
              <th className="px-4 py-3 font-semibold">동네</th>
              <th className="px-4 py-3 font-semibold">상태</th>
              <th className="px-4 py-3 font-semibold">최근가</th>
              <th className="px-4 py-3 font-semibold">평형대</th>
              <th className="px-4 py-3 font-semibold">접근성</th>
              <th className="px-4 py-3 font-semibold">데이터</th>
              <th className="px-4 py-3 font-semibold">메모</th>
              {session && isAdmin ? (
                <th className="px-4 py-3 font-semibold">관리</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((apartment) => (
              <ApartmentRow key={apartment.id} {...apartment}>
                {session && isAdmin ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const row = apartments.find(
                          (item) => item.id === apartment.id,
                        );

                        if (row) {
                          startEdit(row);
                        }
                      }}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(apartment.id)}
                      className="rounded-md border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700"
                    >
                      삭제
                    </button>
                  </div>
                ) : null}
              </ApartmentRow>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((apartment) => (
          <article
            key={apartment.id}
            className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/apartments/${apartment.id}`}
                  className="break-keep font-semibold text-slate-950"
                >
                  {apartment.name}
                </Link>
                <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                  {apartment.address}
                </p>
              </div>
              <StatusPill status={apartment.status} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 text-sm min-[380px]:grid-cols-2">
              <MobileApartmentMetric label="동네" value={apartment.neighborhood} />
              <MobileApartmentMetric label="최근가" value={apartment.latestPrice} />
              <MobileApartmentMetric label="평형대" value={apartment.areaSummary} />
                <MobileApartmentMetric
                  label="접근성"
                value={
                  "accessSummary" in apartment
                    ? (apartment.accessSummary ?? "접근성 미입력")
                    : "접근성 미입력"
                }
                />
            </div>
            <p className="mt-3 break-words text-xs leading-5 text-slate-500">
              {apartment.sourceState}
            </p>
            <p className="mt-2 break-words text-sm leading-6 text-slate-700">
              {apartment.note}
            </p>
            {session && isAdmin ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const row = apartments.find((item) => item.id === apartment.id);

                    if (row) {
                      startEdit(row);
                    }
                  }}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(apartment.id)}
                  className="flex-1 rounded-md border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700"
                >
                  삭제
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function MobileApartmentMetric({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function CommuteInputs({
  durationValue,
  onDurationChange,
  onTransferChange,
  title,
  transferValue,
}: Readonly<{
  durationValue: string;
  onDurationChange: (value: string) => void;
  onTransferChange: (value: string) => void;
  title: string;
  transferValue: string;
}>) {
  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600">
          소요시간
          <input
            value={durationValue}
            onChange={(event) => onDurationChange(event.target.value)}
            inputMode="numeric"
            className="min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="분"
          />
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600">
          환승
          <input
            value={transferValue}
            onChange={(event) => onTransferChange(event.target.value)}
            inputMode="numeric"
            className="min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="회"
          />
        </label>
      </div>
    </div>
  );
}

function formatCommuteListSummary(
  summary: CommuteAccessSummary | null,
) {
  if (!summary) {
    return "접근성 미입력";
  }

  return [
    formatCommuteLine("여의도", summary.yeouido_station.transit, summary.yeouido_station.driving),
    formatCommuteLine("강남", summary.gangnam_station.transit, summary.gangnam_station.driving),
  ].join(" / ");
}

function formatCommuteLine(
  label: string,
  transit: CommuteSummary | null,
  driving: CommuteSummary | null,
) {
  if (!transit && !driving) {
    return `${label} -`;
  }

  return `${label} 대중 ${formatCommuteDuration(transit)} · 자차 ${formatCommuteDuration(
    driving,
  )}`;
}

function formatCommuteDuration(commute: CommuteSummary | null) {
  return commute ? `${commute.durationMinutes}분` : "-";
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

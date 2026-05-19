"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ApartmentRow } from "@/components/apartments/apartment-row";
import { AuthPanel } from "@/components/auth/auth-panel";
import { getRoleFromAppMetadata, isAdminRole } from "@/lib/auth/user-role";
import { apartments as mockApartments } from "@/lib/mock-data";
import {
  apartmentStatusValues,
  validateApartmentInput,
} from "@/lib/forms/home-data";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type {
  ApartmentRowData,
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
  status: string;
  memo: string;
  kbUrl: string;
  naverLandUrl: string;
};

const emptyForm: ApartmentFormState = {
  id: null,
  name: "",
  neighborhoodId: "",
  address: "",
  roadAddress: "",
  lawdCd: "",
  status: "candidate",
  memo: "",
  kbUrl: "",
  naverLandUrl: "",
};

export function ApartmentsClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [apartments, setApartments] = useState<ApartmentRowData[]>([]);
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

    const [{ data: apartmentRows, error: apartmentError }, { data: neighborhoodRows }] =
      await Promise.all([
        supabase
          .from("apartments")
          .select("*")
          .order("updated_at", { ascending: false }),
        supabase.from("neighborhoods").select("*").order("name"),
      ]);

    if (apartmentError) {
      setMessage(apartmentError.message);
    } else {
      setApartments((apartmentRows ?? []) as ApartmentRowData[]);
      setNeighborhoods((neighborhoodRows ?? []) as NeighborhoodRow[]);
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
        setNeighborhoods([]);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadData, supabase]);

  const rows = useMemo(() => {
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
      sourceState: apartment.lawd_cd
        ? `법정동코드 ${apartment.lawd_cd}`
        : "법정동코드 필요",
      note: apartment.memo ?? "메모 없음",
    }));
  }, [apartments, neighborhoods, session]);

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
      ? supabase.from("apartments").update(validated.value).eq("id", form.id)
      : supabase.from("apartments").insert(validated.value);

    const { error } = await query;

    if (error) {
      setMessage(error.message);
    } else {
      setForm(emptyForm);
      await loadData();
      setMessage(form.id ? "단지를 수정했습니다." : "단지를 추가했습니다.");
    }

    setIsLoading(false);
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
      status: apartment.status,
      memo: apartment.memo ?? "",
      kbUrl: apartment.kb_url ?? "",
      naverLandUrl: apartment.naver_land_url ?? "",
    });
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
                국토부 API에는 앞 5자리 시군구 코드가 필요합니다. 10자리 법정동코드를
                붙여넣으면 앞 5자리만 저장합니다.
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

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[960px] text-left">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">단지</th>
              <th className="px-4 py-3 font-semibold">동네</th>
              <th className="px-4 py-3 font-semibold">상태</th>
              <th className="px-4 py-3 font-semibold">최근가</th>
              <th className="px-4 py-3 font-semibold">평형대</th>
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
    </div>
  );
}

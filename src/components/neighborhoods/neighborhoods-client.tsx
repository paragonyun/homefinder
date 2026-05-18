"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth/auth-panel";
import { NeighborhoodCard } from "@/components/neighborhoods/neighborhood-card";
import { neighborhoods as mockNeighborhoods } from "@/lib/mock-data";
import { validateNeighborhoodInput } from "@/lib/forms/home-data";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type {
  ApartmentRowData,
  NeighborhoodRow,
} from "@/lib/supabase/table-types";

type NeighborhoodFormState = {
  id: string | null;
  name: string;
  description: string;
  city: string;
  district: string;
  dong: string;
};

const emptyForm: NeighborhoodFormState = {
  id: null,
  name: "",
  description: "",
  city: "",
  district: "",
  dong: "",
};

export function NeighborhoodsClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodRow[]>([]);
  const [apartments, setApartments] = useState<ApartmentRowData[]>([]);
  const [form, setForm] = useState<NeighborhoodFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  const loadData = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setIsLoading(true);

    const [{ data: neighborhoodRows, error: neighborhoodError }, { data: apartmentRows }] =
      await Promise.all([
        supabase
          .from("neighborhoods")
          .select("*")
          .order("updated_at", { ascending: false }),
        supabase.from("apartments").select("*"),
      ]);

    if (neighborhoodError) {
      setMessage(neighborhoodError.message);
    } else {
      setNeighborhoods((neighborhoodRows ?? []) as NeighborhoodRow[]);
      setApartments((apartmentRows ?? []) as ApartmentRowData[]);
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
        setNeighborhoods([]);
        setApartments([]);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadData, supabase]);

  const cards = useMemo(() => {
    if (!session) {
      return mockNeighborhoods;
    }

    return neighborhoods.map((neighborhood) => {
      const relatedApartments = apartments.filter(
        (apartment) => apartment.neighborhood_id === neighborhood.id,
      );

      return {
        id: neighborhood.id,
        name: neighborhood.name,
        description: neighborhood.description ?? "메모 없음",
        apartments: relatedApartments.length,
        interested: relatedApartments.filter(
          (apartment) => apartment.status === "interested",
        ).length,
        onHold: relatedApartments.filter(
          (apartment) => apartment.status === "on_hold",
        ).length,
        excluded: relatedApartments.filter(
          (apartment) => apartment.status === "excluded",
        ).length,
        avgPriceRange: "실거래가 연동 전",
        yeouidoSummary: "계산 예정",
        gangnamSummary: "계산 예정",
        updatedAt: neighborhood.updated_at,
      };
    });
  }, [apartments, neighborhoods, session]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !session) {
      setMessage("Supabase 연결과 로그인이 필요합니다.");
      return;
    }

    const validated = validateNeighborhoodInput(form);

    if (!validated.ok) {
      setMessage(validated.error);
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const query = form.id
      ? supabase
          .from("neighborhoods")
          .update(validated.value)
          .eq("id", form.id)
      : supabase.from("neighborhoods").insert(validated.value);

    const { error } = await query;

    if (error) {
      setMessage(error.message);
    } else {
      setForm(emptyForm);
      await loadData();
      setMessage(form.id ? "동네를 수정했습니다." : "동네를 추가했습니다.");
    }

    setIsLoading(false);
  }

  async function handleDelete(id: string) {
    if (!supabase || !session) {
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.from("neighborhoods").delete().eq("id", id);

    if (error) {
      setMessage(error.message);
    } else {
      await loadData();
      setMessage("동네를 삭제했습니다.");
    }

    setIsLoading(false);
  }

  function startEdit(neighborhood: NeighborhoodRow) {
    setForm({
      id: neighborhood.id,
      name: neighborhood.name,
      description: neighborhood.description ?? "",
      city: neighborhood.city ?? "",
      district: neighborhood.district ?? "",
      dong: neighborhood.dong ?? "",
    });
  }

  return (
    <div className="grid gap-5">
      <AuthPanel />

      {session ? (
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {form.id ? "동네 수정" : "동네 추가"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              관심 권역을 먼저 만들고, 단지는 이 동네에 연결합니다.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              동네명
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="예: 신길동"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              구
              <input
                value={form.district}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    district: event.target.value,
                  }))
                }
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="예: 영등포구"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              메모
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                placeholder="접근성, 가격대, 임장 포인트"
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
          현재는 예시 데이터가 표시됩니다. Supabase 환경변수와 로그인 세션이
          준비되면 실제 CRUD 목록으로 전환됩니다.
        </p>
      ) : null}

      <div className="grid gap-4">
        {cards.map((neighborhood) => (
          <div key={neighborhood.id} className="grid gap-2">
            <NeighborhoodCard {...neighborhood} />
            {session ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const row = neighborhoods.find(
                      (item) => item.id === neighborhood.id,
                    );

                    if (row) {
                      startEdit(row);
                    }
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(neighborhood.id)}
                  className="rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700"
                >
                  삭제
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

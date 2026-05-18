"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth/auth-panel";
import { validateFieldNoteInput } from "@/lib/forms/home-data";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type { FieldNoteRow } from "@/lib/supabase/table-types";
import { formatDate } from "@/utils/date";

type FieldNotesClientProps = {
  apartmentId: string;
  apartmentName: string;
  isMockApartment: boolean;
};

type FieldNoteFormState = {
  visitDate: string;
  visitTime: string;
  weather: string;
  overallRating: string;
  goodPoints: string;
  badPoints: string;
  overallMemo: string;
};

const emptyForm: FieldNoteFormState = {
  visitDate: "",
  visitTime: "",
  weather: "",
  overallRating: "",
  goodPoints: "",
  badPoints: "",
  overallMemo: "",
};

export function FieldNotesClient({
  apartmentId,
  apartmentName,
  isMockApartment,
}: Readonly<FieldNotesClientProps>) {
  const [session, setSession] = useState<Session | null>(null);
  const [notes, setNotes] = useState<FieldNoteRow[]>([]);
  const [form, setForm] = useState<FieldNoteFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  const loadNotes = useCallback(async () => {
    if (!supabase || isMockApartment) {
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from("field_notes")
      .select("*")
      .eq("apartment_id", apartmentId)
      .order("visit_date", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setNotes((data ?? []) as FieldNoteRow[]);
    }

    setIsLoading(false);
  }, [apartmentId, isMockApartment, supabase]);

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
        void loadNotes();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession) {
        void loadNotes();
      } else {
        setNotes([]);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadNotes, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !session || isMockApartment) {
      setMessage("실제 Supabase 단지에서만 임장 메모를 저장할 수 있습니다.");
      return;
    }

    const validated = validateFieldNoteInput({
      apartmentId,
      ...form,
    });

    if (!validated.ok) {
      setMessage(validated.error);
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.from("field_notes").insert(validated.value);

    if (error) {
      setMessage(error.message);
    } else {
      setForm(emptyForm);
      await loadNotes();
      setMessage("임장 메모를 저장했습니다.");
    }

    setIsLoading(false);
  }

  async function handleDelete(id: string) {
    if (!supabase || !session) {
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.from("field_notes").delete().eq("id", id);

    if (error) {
      setMessage(error.message);
    } else {
      await loadNotes();
      setMessage("임장 메모를 삭제했습니다.");
    }

    setIsLoading(false);
  }

  return (
    <div className="grid gap-5">
      <AuthPanel />

      {!isSupabaseConfigured || !session || isMockApartment ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
          {isMockApartment
            ? "현재 예시 단지입니다. 실제 Supabase에 등록한 단지 상세에서 임장 메모 저장이 활성화됩니다."
            : "Supabase 환경변수와 로그인 세션이 준비되면 임장 메모를 저장할 수 있습니다."}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5"
      >
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            모바일 임장 메모
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            {apartmentName}
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            방문일
            <input
              type="date"
              value={form.visitDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  visitDate: event.target.value,
                }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            방문 시간대
            <input
              value={form.visitTime}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  visitTime: event.target.value,
                }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="예: 평일 저녁"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            날씨
            <input
              value={form.weather}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  weather: event.target.value,
                }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="예: 흐림"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            종합 평점
            <input
              value={form.overallRating}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  overallRating: event.target.value,
                }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="1-5"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            장점
            <textarea
              value={form.goodPoints}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  goodPoints: event.target.value,
                }))
              }
              className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            단점
            <textarea
              value={form.badPoints}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  badPoints: event.target.value,
                }))
              }
              className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
            한 줄 총평
            <textarea
              value={form.overallMemo}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  overallMemo: event.target.value,
                }))
              }
              className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={isLoading || !session || isMockApartment}
          className="w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
        >
          저장
        </button>
      </form>

      {message ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </p>
      ) : null}

      {notes.length > 0 ? (
        <section className="grid gap-3">
          {notes.map((note) => (
            <article
              key={note.id}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {formatDate(note.visit_date)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {note.overall_memo ?? "총평 없음"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(note.id)}
                  className="w-fit rounded-md border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700"
                >
                  삭제
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

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

const ratingOptions = [1, 2, 3, 4, 5] as const;
const weatherOptions = ["맑음", "흐림", "비", "눈", "더움", "추움"] as const;

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
  const canSave = isSupabaseConfigured && Boolean(session) && !isMockApartment;

  function updateFormField(field: keyof FieldNoteFormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

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
        className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Field note
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              {apartmentName}
            </h2>
          </div>
          <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            기록 {notes.length.toLocaleString("ko-KR")}건
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            방문일
            <input
              type="date"
              value={form.visitDate}
              onChange={(event) =>
                updateFormField("visitDate", event.target.value)
              }
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            방문 시간대
            <input
              value={form.visitTime}
              onChange={(event) =>
                updateFormField("visitTime", event.target.value)
              }
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="예: 평일 저녁"
            />
          </label>
          <div className="grid gap-2 text-sm font-medium text-slate-700">
            날씨
            <div className="flex flex-wrap gap-2">
              {weatherOptions.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => updateFormField("weather", option)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    form.weather === option
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <input
              value={form.weather}
              onChange={(event) =>
                updateFormField("weather", event.target.value)
              }
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="직접 입력"
            />
          </div>
          <div className="grid gap-2 text-sm font-medium text-slate-700">
            종합 평점
            <div className="grid grid-cols-5 gap-2">
              {ratingOptions.map((rating) => (
                <button
                  type="button"
                  key={rating}
                  aria-pressed={form.overallRating === String(rating)}
                  onClick={() =>
                    updateFormField(
                      "overallRating",
                      form.overallRating === String(rating) ? "" : String(rating),
                    )
                  }
                  className={`h-11 rounded-md border text-sm font-semibold transition ${
                    form.overallRating === String(rating)
                      ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            장점
            <textarea
              value={form.goodPoints}
              onChange={(event) =>
                updateFormField("goodPoints", event.target.value)
              }
              className="min-h-28 rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="좋았던 점"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            단점
            <textarea
              value={form.badPoints}
              onChange={(event) =>
                updateFormField("badPoints", event.target.value)
              }
              className="min-h-28 rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="아쉬웠던 점"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
            한 줄 총평
            <textarea
              value={form.overallMemo}
              onChange={(event) =>
                updateFormField("overallMemo", event.target.value)
              }
              className="min-h-28 rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="다시 볼지, 보류할지, 추가 확인할 점"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={isLoading || !canSave}
          className="w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:bg-slate-400 sm:w-fit"
        >
          {isLoading ? "저장 중" : "임장 메모 저장"}
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
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-950">
                    {formatDate(note.visit_date)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <NoteMeta label={note.visit_time ?? "시간 미입력"} />
                    <NoteMeta label={note.weather ?? "날씨 미입력"} />
                    <NoteMeta
                      label={
                        note.overall_rating !== null
                          ? `평점 ${note.overall_rating}/5`
                          : "평점 미입력"
                      }
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(note.id)}
                  disabled={isLoading}
                  className="w-fit rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:text-slate-400"
                >
                  삭제
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <NoteSection label="장점" value={note.good_points} />
                <NoteSection label="단점" value={note.bad_points} />
                <NoteSection
                  label="총평"
                  value={note.overall_memo}
                  className="md:col-span-2"
                />
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function NoteMeta({ label }: Readonly<{ label: string }>) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
      {label}
    </span>
  );
}

function NoteSection({
  className = "",
  label,
  value,
}: Readonly<{ className?: string; label: string; value: string | null }>) {
  return (
    <div className={`rounded-md border border-slate-200 bg-slate-50 p-3 ${className}`}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
        {value ?? "-"}
      </p>
    </div>
  );
}

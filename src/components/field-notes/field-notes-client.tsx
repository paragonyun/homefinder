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
  showAuthPanel?: boolean;
};

type FieldNoteFormState = {
  visitDate: string;
  visitTime: string;
  weather: string;
  revisitIntention: string;
  stationWalkRating: string;
  slopeRating: string;
  complexConditionRating: string;
  parkingRating: string;
  noiseRating: string;
  nightMoodRating: string;
  commercialAreaRating: string;
  overallRating: string;
  goodPoints: string;
  badPoints: string;
  parkingNote: string;
  noiseNote: string;
  slopeNote: string;
  overallMemo: string;
};

const emptyForm: FieldNoteFormState = {
  visitDate: "",
  visitTime: "",
  weather: "",
  revisitIntention: "",
  stationWalkRating: "",
  slopeRating: "",
  complexConditionRating: "",
  parkingRating: "",
  noiseRating: "",
  nightMoodRating: "",
  commercialAreaRating: "",
  overallRating: "",
  goodPoints: "",
  badPoints: "",
  parkingNote: "",
  noiseNote: "",
  slopeNote: "",
  overallMemo: "",
};

const ratingOptions = [1, 2, 3, 4, 5] as const;
const weatherOptions = ["맑음", "흐림", "비", "눈", "더움", "추움"] as const;
const revisitOptions = ["관심 유지", "보류", "제외", "재확인 필요"] as const;
const checklistItems = [
  { field: "stationWalkRating", label: "교통 동선" },
  { field: "slopeRating", label: "경사/언덕" },
  { field: "complexConditionRating", label: "단지 관리" },
  { field: "parkingRating", label: "주차" },
  { field: "noiseRating", label: "소음" },
  { field: "nightMoodRating", label: "야간 분위기" },
  { field: "commercialAreaRating", label: "생활 편의" },
] as const satisfies readonly {
  field: keyof FieldNoteFormState;
  label: string;
}[];

export function FieldNotesClient({
  apartmentId,
  apartmentName,
  isMockApartment,
  showAuthPanel = true,
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
      {showAuthPanel ? <AuthPanel /> : null}

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
            <p className="mt-2 text-sm leading-6 text-slate-600">
              방문 당시 체감한 장점, 리스크, 재확인할 내용을 판단 근거로 남깁니다.
            </p>
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
            <RatingButtons
              value={form.overallRating}
              onChange={(value) => updateFormField("overallRating", value)}
            />
          </div>
          <div className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
            한 줄 결론
            <div className="flex flex-wrap gap-2">
              {revisitOptions.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => updateFormField("revisitIntention", option)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    form.revisitIntention === option
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <input
              value={form.revisitIntention}
              onChange={(event) =>
                updateFormField("revisitIntention", event.target.value)
              }
              className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="직접 입력"
            />
          </div>
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
            <p className="text-sm font-semibold text-slate-800">체감 체크리스트</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {checklistItems.map((item) => (
                <div key={item.field} className="grid gap-2">
                  <p className="text-xs font-semibold text-slate-600">
                    {item.label}
                  </p>
                  <RatingButtons
                    value={form[item.field]}
                    onChange={(value) => updateFormField(item.field, value)}
                  />
                </div>
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
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            주차 메모
            <textarea
              value={form.parkingNote}
              onChange={(event) =>
                updateFormField("parkingNote", event.target.value)
              }
              className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="주차장 동선, 여유, 이중주차"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            소음 메모
            <textarea
              value={form.noiseNote}
              onChange={(event) =>
                updateFormField("noiseNote", event.target.value)
              }
              className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="대로변, 상가, 단지 내부 소음"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
            경사/동선 메모
            <textarea
              value={form.slopeNote}
              onChange={(event) =>
                updateFormField("slopeNote", event.target.value)
              }
              className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="언덕, 횡단보도, 역/버스정류장까지 체감 동선"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
            총평 / 다시 확인할 것
            <textarea
              value={form.overallMemo}
              onChange={(event) =>
                updateFormField("overallMemo", event.target.value)
              }
              className="min-h-28 rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="다음 방문이나 매수 검토 전에 다시 확인할 점"
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
                      label={note.revisit_intention ?? "결론 미입력"}
                    />
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
              <FieldNoteRatingSummary note={note} />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <NoteSection label="장점" value={note.good_points} />
                <NoteSection label="단점" value={note.bad_points} />
                <NoteSection label="주차" value={note.parking_note} />
                <NoteSection label="소음" value={note.noise_note} />
                <NoteSection label="경사/동선" value={note.slope_note} />
                <NoteSection
                  label="총평 / 다시 확인할 것"
                  value={note.overall_memo}
                />
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function RatingButtons({
  onChange,
  value,
}: Readonly<{ onChange: (value: string) => void; value: string }>) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {ratingOptions.map((rating) => {
        const nextValue = String(rating);

        return (
          <button
            type="button"
            key={rating}
            aria-pressed={value === nextValue}
            onClick={() => onChange(value === nextValue ? "" : nextValue)}
            className={`h-10 rounded-md border text-sm font-semibold transition ${
              value === nextValue
                ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {rating}
          </button>
        );
      })}
    </div>
  );
}

function FieldNoteRatingSummary({ note }: Readonly<{ note: FieldNoteRow }>) {
  const ratings = [
    ["교통", note.station_walk_rating],
    ["경사", note.slope_rating],
    ["관리", note.complex_condition_rating],
    ["주차", note.parking_rating],
    ["소음", note.noise_rating],
    ["야간", note.night_mood_rating],
    ["생활", note.commercial_area_rating],
  ].filter(([, value]) => value !== null);

  if (ratings.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {ratings.map(([label, value]) => (
        <span
          key={label}
          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700"
        >
          {label} {value}/5
        </span>
      ))}
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

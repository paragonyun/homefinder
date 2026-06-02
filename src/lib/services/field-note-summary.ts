export type FieldNoteSummaryInput = {
  apartment_id: string;
  visit_date: string | null;
  overall_rating: number | null;
  revisit_intention: string | null;
  overall_memo: string | null;
  bad_points: string | null;
  parking_note: string | null;
  noise_note: string | null;
  slope_note: string | null;
  created_at: string;
  updated_at: string;
};

export type FieldNoteSummary = {
  apartmentId: string;
  visitDate: string | null;
  overallRating: number | null;
  conclusion: string | null;
  recheckText: string | null;
  updatedAt: string;
};

export function getLatestFieldNoteByApartmentId<
  T extends FieldNoteSummaryInput,
>(notes: T[]) {
  const latestByApartmentId = new Map<string, T>();

  for (const note of notes) {
    const current = latestByApartmentId.get(note.apartment_id);

    if (!current || compareFieldNotes(note, current) > 0) {
      latestByApartmentId.set(note.apartment_id, note);
    }
  }

  return latestByApartmentId;
}

export function buildLatestFieldNoteSummary(
  note: FieldNoteSummaryInput | null,
): FieldNoteSummary | null {
  if (!note) {
    return null;
  }

  return {
    apartmentId: note.apartment_id,
    visitDate: note.visit_date,
    overallRating: note.overall_rating,
    conclusion: cleanText(note.revisit_intention),
    recheckText: getRecheckText(note),
    updatedAt: note.updated_at,
  };
}

function compareFieldNotes(
  left: FieldNoteSummaryInput,
  right: FieldNoteSummaryInput,
) {
  const leftVisitDate = left.visit_date ?? "";
  const rightVisitDate = right.visit_date ?? "";
  const visitDateComparison = leftVisitDate.localeCompare(rightVisitDate);

  if (visitDateComparison !== 0) {
    return visitDateComparison;
  }

  const leftUpdatedAt = left.updated_at || left.created_at;
  const rightUpdatedAt = right.updated_at || right.created_at;

  return leftUpdatedAt.localeCompare(rightUpdatedAt);
}

function getRecheckText(note: FieldNoteSummaryInput) {
  return (
    cleanText(note.overall_memo) ??
    cleanText(note.bad_points) ??
    cleanText(note.parking_note) ??
    cleanText(note.noise_note) ??
    cleanText(note.slope_note)
  );
}

function cleanText(value: string | null) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

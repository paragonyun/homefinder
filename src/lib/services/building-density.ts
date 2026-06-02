export function normalizeBuildingDensityRatio(
  value: number | null | undefined,
) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function formatBuildingDensityRatio(
  value: number | null | undefined,
  missingLabel = "-",
) {
  const normalized = normalizeBuildingDensityRatio(value);

  return normalized !== null
    ? `${normalized.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`
    : missingLabel;
}

export function buildLinearTicks(
  minValue: number,
  maxValue: number,
  desiredTickCount = 5,
) {
  if (
    !Number.isFinite(minValue) ||
    !Number.isFinite(maxValue) ||
    desiredTickCount <= 0
  ) {
    return [];
  }

  const min = Math.min(minValue, maxValue);
  const max = Math.max(minValue, maxValue);

  if (min === max) {
    if (desiredTickCount === 1) {
      return [min];
    }

    const padding = Math.max(Math.abs(min) * 0.08, 100_000_000);
    return buildLinearTicks(
      Math.max(0, min - padding),
      min + padding,
      desiredTickCount,
    );
  }

  const rawStep = (max - min) / Math.max(1, desiredTickCount - 1);
  const step = getNiceStep(rawStep);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];

  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Math.round(value));
  }

  return Array.from(new Set(ticks)).slice(-desiredTickCount);
}

export function getVisibleMonthLabels(months: string[], maxLabelCount = 6) {
  if (months.length <= maxLabelCount) {
    return months;
  }

  const lastIndex = months.length - 1;
  const step = Math.ceil(lastIndex / (maxLabelCount - 1));

  return months.filter(
    (_month, index) => index === 0 || index === lastIndex || index % step === 0,
  );
}

function getNiceStep(value: number) {
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const fraction = value / base;

  if (fraction <= 1) {
    return base;
  }

  if (fraction <= 2) {
    return base * 2;
  }

  if (fraction <= 5) {
    return base * 5;
  }

  return base * 10;
}

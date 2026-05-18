export function formatKrw(value: number | null | undefined) {
  if (!value) {
    return "데이터 없음";
  }

  const eok = value / 100_000_000;
  return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
}

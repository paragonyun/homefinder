export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "갱신 전";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

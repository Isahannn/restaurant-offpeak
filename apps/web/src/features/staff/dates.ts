/** Local calendar date as YYYY-MM-DD (slots are stored per local restaurant day). */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftDate(dateString: string, days: number): string {
  const [y, m, d] = dateString.split("-").map(Number);
  return toLocalDateString(new Date(y, m - 1, d + days));
}

export function formatDayLabel(dateString: string): string {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
}

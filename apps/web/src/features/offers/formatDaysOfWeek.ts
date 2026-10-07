const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function formatDaysOfWeek(daysOfWeek: number[]): string {
  // Monday-first: Sunday (0) sorts last.
  return [...daysOfWeek]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((day) => DAY_LABELS[day])
    .join(", ");
}

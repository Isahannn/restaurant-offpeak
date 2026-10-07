const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTH_LABELS = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

export function formatSlotLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const day = DAY_LABELS[date.getUTCDay()];
  const dayOfMonth = date.getUTCDate();
  const month = MONTH_LABELS[date.getUTCMonth()];
  return `${day}, ${dayOfMonth} ${month}`;
}

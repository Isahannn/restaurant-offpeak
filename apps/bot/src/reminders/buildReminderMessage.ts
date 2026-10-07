export interface ReminderMessageInput {
  restaurantName: string;
  offerTitle: string;
  startTime: string;
  partySize: number;
  discountPercent: number;
  code: string;
}

export function buildReminderMessage(input: ReminderMessageInput): string {
  const discount = input.discountPercent > 0 ? `, скидка ${input.discountPercent}%` : "";

  return [
    `Напоминаем о брони сегодня в ${input.startTime}`,
    `${input.restaurantName} · ${input.offerTitle}${discount}`,
    `Гостей: ${input.partySize}`,
    "",
    `Код брони: ${input.code} — покажите его при входе.`,
  ].join("\n");
}

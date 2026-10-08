export interface VisitMessageInput {
  status: "arrived" | "no_show";
  restaurantName: string;
  offerTitle: string;
  day: string;
  startTime: string;
  discountPercent: number;
}

export interface VisitMessage {
  text: string;
  /** Label of the button that disputes this mark. */
  disputeLabel: string;
}

export function buildVisitMessage(input: VisitMessageInput): VisitMessage {
  if (input.status === "arrived") {
    const discount = input.discountPercent > 0 ? ` · скидка ${input.discountPercent}%` : "";
    return {
      text: [
        `Спасибо, что зашли в ${input.restaurantName}!`,
        `${input.offerTitle} · ${input.day}, ${input.startTime}${discount}`,
        "",
        "Вас там не было? Нажмите кнопку — ресторан увидит отметку.",
      ].join("\n"),
      disputeLabel: "Меня там не было",
    };
  }

  return {
    text: [
      `Похоже, вы не пришли в ${input.restaurantName} (${input.day}, ${input.startTime}).`,
      "",
      "Если вы были в ресторане — нажмите кнопку, ресторан увидит отметку.",
    ].join("\n"),
    disputeLabel: "Я был в ресторане",
  };
}

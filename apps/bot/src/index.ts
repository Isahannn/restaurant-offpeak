import { Bot, GrammyError } from "grammy";
import { prisma } from "@app/db";
import { isAdmin } from "./admin/isAdmin.js";
import { markNoShows } from "./noShow/markNoShowsJob.js";
import { runReminderTick } from "./reminders/reminderJob.js";
import { startScheduler } from "./scheduler.js";
import { runStaffNotificationTick } from "./staffNotifications/notifyStaffJob.js";
import { disputeVisit } from "./visitNotifications/disputeVisit.js";
import { runGuestVisitTick } from "./visitNotifications/notifyGuestVisitJob.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is not set");
}

const webAppUrl = process.env.WEBAPP_URL;
const adminTelegramIds = process.env.ADMIN_TELEGRAM_IDS;
const reminderLeadMinutes = Number(process.env.REMINDER_LEAD_MINUTES ?? 120);
const noShowGraceMinutes = Number(process.env.NO_SHOW_GRACE_MINUTES ?? 30);
const appTimeZone = process.env.APP_TIMEZONE ?? "Europe/Moscow";
const JOB_INTERVAL_MS = 60 * 1000;

if (!Number.isInteger(reminderLeadMinutes) || reminderLeadMinutes <= 0) {
  throw new Error("REMINDER_LEAD_MINUTES must be a positive integer");
}
if (!Number.isInteger(noShowGraceMinutes) || noShowGraceMinutes < 0) {
  throw new Error("NO_SHOW_GRACE_MINUTES must be a non-negative integer");
}
try {
  new Intl.DateTimeFormat("en-US", { timeZone: appTimeZone });
} catch {
  throw new Error(`APP_TIMEZONE "${appTimeZone}" is not a valid IANA time zone`);
}

const bot = new Bot(token);

bot.command("start", async (ctx) => {
  if (webAppUrl) {
    await ctx.reply("Добро пожаловать! Открой мини-апп, чтобы посмотреть предложения.", {
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть предложения", web_app: { url: webAppUrl } }]],
      },
    });
  } else {
    await ctx.reply("Бот запущен. WEBAPP_URL не задан.");
  }
});

bot.command("register_restaurant", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId, adminTelegramIds)) {
    await ctx.reply("Команда доступна только администратору.");
    return;
  }

  const name = ctx.match.trim();
  if (!name) {
    await ctx.reply("Использование: /register_restaurant <название>");
    return;
  }

  const restaurant = await prisma.restaurant.create({ data: { name } });
  await ctx.reply(`Ресторан создан.\nID: ${restaurant.id}\nНазвание: ${restaurant.name}`);
});

bot.command("add_staff", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId, adminTelegramIds)) {
    await ctx.reply("Команда доступна только администратору.");
    return;
  }

  const parts = ctx.match.trim().split(/\s+/).filter(Boolean);
  const [restaurantId, telegramUserIdRaw, roleRaw] = parts;

  if (!restaurantId || !telegramUserIdRaw) {
    await ctx.reply("Использование: /add_staff <restaurantId> <telegramUserId> [owner|staff]");
    return;
  }

  const telegramUserId = BigInt(telegramUserIdRaw);
  const role = roleRaw === "owner" ? "owner" : "staff";

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) {
    await ctx.reply(`Ресторан с ID ${restaurantId} не найден.`);
    return;
  }

  await prisma.restaurantStaff.upsert({
    where: { telegramUserId },
    create: { restaurantId, telegramUserId, role },
    update: { restaurantId, role },
  });

  await ctx.reply(
    `Пользователь ${telegramUserId} назначен как "${role}" в ресторане "${restaurant.name}".`,
  );
});

const DISPUTE_PREFIX = "dispute:";

// The guest disputes how their visit was marked (button under the visit message).
bot.callbackQuery(new RegExp(`^${DISPUTE_PREFIX}`), async (ctx) => {
  const bookingId = ctx.callbackQuery.data.slice(DISPUTE_PREFIX.length);
  const result = await disputeVisit(bookingId, BigInt(ctx.from.id), new Date());

  if (result === "not_found") {
    await ctx.answerCallbackQuery({ text: "Эта бронь не найдена", show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery({ text: "Спасибо! Ресторан увидит, что вы оспорили отметку." });
  // Drop the button so it can't be pressed again; keep the message itself.
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
  await ctx.reply("Отметка оспорена — ресторан это увидит. Спасибо, что сообщили.").catch(() => {});
});

/** The user blocked the bot or never opened it: retrying cannot succeed. */
function isPermanentTelegramFailure(err: unknown): boolean {
  if (!(err instanceof GrammyError)) return false;
  return err.error_code === 403 || (err.error_code === 400 && /chat not found/i.test(err.description));
}

function sendWithAppButton(buttonText: string) {
  return async ({ chatId, text }: { chatId: bigint; text: string }) => {
    await bot.api.sendMessage(Number(chatId), text, {
      reply_markup: webAppUrl ? { inline_keyboard: [[{ text: buttonText, web_app: { url: webAppUrl } }]] } : undefined,
    });
  };
}

const logJobError = (job: string) => (err: unknown, bookingId: string) =>
  console.error(`${job} for booking ${bookingId} failed:`, err);

const summarize = ({ sent, failed }: { sent: number; failed: number }) =>
  sent > 0 || failed > 0 ? `sent ${sent}, failed ${failed}` : null;

const stopJobs = startScheduler({
  intervalMs: JOB_INTERVAL_MS,
  log: (message) => console.log(message),
  jobs: [
    {
      name: "staff-notifications",
      run: async (now) =>
        summarize(
          await runStaffNotificationTick({
            now,
            timeZone: appTimeZone,
            send: sendWithAppButton("Открыть панель"),
            isPermanentFailure: isPermanentTelegramFailure,
            onError: logJobError("staff notification"),
          }),
        ),
    },
    {
      name: "reminders",
      run: async (now) =>
        summarize(
          await runReminderTick({
            now,
            leadMinutes: reminderLeadMinutes,
            timeZone: appTimeZone,
            send: sendWithAppButton("Мои брони"),
            isPermanentFailure: isPermanentTelegramFailure,
            onError: logJobError("reminder"),
          }),
        ),
    },
    {
      name: "guest-visits",
      run: async (now) =>
        summarize(
          await runGuestVisitTick({
            now,
            timeZone: appTimeZone,
            send: async ({ chatId, text, bookingId, disputeLabel }) => {
              await bot.api.sendMessage(Number(chatId), text, {
                reply_markup: { inline_keyboard: [[{ text: disputeLabel, callback_data: `${DISPUTE_PREFIX}${bookingId}` }]] },
              });
            },
            isPermanentFailure: isPermanentTelegramFailure,
            onError: logJobError("guest visit message"),
          }),
        ),
    },
    {
      name: "no-shows",
      run: async (now) => {
        const marked = await markNoShows({ now, timeZone: appTimeZone, graceMinutes: noShowGraceMinutes });
        return marked > 0 ? `marked ${marked}` : null;
      },
    },
  ],
});

const shutdown = async () => {
  stopJobs();
  await bot.stop();
  await prisma.$disconnect();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

bot.start();

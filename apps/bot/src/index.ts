import { Bot, GrammyError } from "grammy";
import { prisma } from "@app/db";
import { isAdmin } from "./admin/isAdmin.js";
import { startReminderScheduler } from "./reminders/startReminderScheduler.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is not set");
}

const webAppUrl = process.env.WEBAPP_URL;
const adminTelegramIds = process.env.ADMIN_TELEGRAM_IDS;
const reminderLeadMinutes = Number(process.env.REMINDER_LEAD_MINUTES ?? 120);
const appTimeZone = process.env.APP_TIMEZONE ?? "Europe/Moscow";

if (!Number.isInteger(reminderLeadMinutes) || reminderLeadMinutes <= 0) {
  throw new Error("REMINDER_LEAD_MINUTES must be a positive integer");
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

const stopReminders = startReminderScheduler({
  leadMinutes: reminderLeadMinutes,
  timeZone: appTimeZone,
  send: async ({ chatId, text }) => {
    await bot.api.sendMessage(Number(chatId), text, {
      reply_markup: webAppUrl
        ? { inline_keyboard: [[{ text: "Мои брони", web_app: { url: webAppUrl } }]] }
        : undefined,
    });
  },
  // 403: the user blocked the bot or never started it; retrying cannot succeed.
  isPermanentFailure: (err) => err instanceof GrammyError && err.error_code === 403,
  onError: (err, bookingId) => console.error(`reminder for booking ${bookingId} failed:`, err),
  log: (message) => console.log(message),
});

const shutdown = async () => {
  stopReminders();
  await bot.stop();
  await prisma.$disconnect();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

bot.start();

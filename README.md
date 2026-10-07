<div align="center">

# TheFood

**Скидки на тихие часы ресторанов — прямо в Telegram**

Рестораны заполняют пустые столики скидками в непопулярное время,<br>
гости бронируют выгодный слот в мини-приложении за пару касаний.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=flat-square&logo=fastify&logoColor=white)
![grammY](https://img.shields.io/badge/grammY-26A5E4?style=flat-square&logo=telegram&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?style=flat-square&logo=docker&logoColor=white)

</div>

---

## Содержание

- [Возможности](#возможности)
- [Как это работает](#как-это-работает)
- [Быстрый старт](#быстрый-старт)
- [Переменные окружения](#переменные-окружения)
- [Команды](#команды)
- [Структура проекта](#структура-проекта)
- [Надёжность](#надёжность)
- [Тесты](#тесты)

---

## Возможности

<table>
<tr>
<td width="50%" valign="top">

### Для гостя

- Лента предложений со скидками и карусель лучших
- Страница ресторана: фото, описание, все слоты
- Выбор даты, времени и количества гостей
- Код брони, который показывается в ресторане
- «Мои брони»: предстоящие и прошедшие, отмена до начала слота
- Напоминание в Telegram за 2 часа до визита

</td>
<td width="50%" valign="top">

### Для ресторана

- Панель персонала прямо в мини-приложении
- **Сегодня** — отметка визита по коду, «пришёл / не пришёл»
- **Предложения** — создание, расписание, часы скидки, вкл/выкл
- **Статистика** — заполненность слотов, визиты и неявки по дням
- Уведомление в Telegram о каждой новой брони
- Неотмеченные брони сами становятся «не пришёл»

</td>
</tr>
</table>

---

## Как это работает

```mermaid
flowchart LR
    Guest(["Гость"]) -->|Telegram| Bot
    Staff(["Персонал"]) -->|Telegram| Bot
    Bot["Бот · grammY"] -->|кнопка WebApp| Web["Мини-апп · React + Vite"]
    Web -->|"/api · initData"| API["API · Fastify"]
    API --> DB[("PostgreSQL")]
    Bot -->|"фоновые задачи"| DB
```

| Сервис | Что делает |
|---|---|
| **`apps/web`** | Мини-приложение. Гость видит ленту и брони, персонал — панель ресторана. Роль определяется автоматически. |
| **`apps/api`** | REST API. Каждый запрос подписан Telegram `initData` (HMAC-SHA256), персонал видит только свой ресторан. Раз в час продлевает слоты на 14 дней вперёд. |
| **`apps/bot`** | Кнопка входа в мини-апп, админ-команды и три фоновые задачи раз в минуту: уведомления персоналу, напоминания гостям, автоотметка неявок. |
| **`packages/db`** | Prisma-схема, миграции и клиент. |
| **`packages/shared`** | Общие типы DTO и работа со временем слотов в таймзоне ресторана. |

**Модель данных:** `Restaurant` → `Offer` (дни недели, часы, скидка, исключения) → `Slot` (конкретная дата и час с лимитом мест) → `Booking` (гость, код, статус).

---

## Быстрый старт

> Понадобятся **Docker**, **Node.js 20+** и токен бота от [@BotFather](https://t.me/BotFather).

**1. Настройте окружение**

```bash
cp .env.example .env
```

Заполните в `.env` как минимум `BOT_TOKEN`, `ADMIN_TELEGRAM_IDS` (свой id можно узнать у [@userinfobot](https://t.me/userinfobot)) и `WEBAPP_URL`.

**2. Поднимите сервисы**

```bash
npm install
docker compose up -d --build
```

**3. Примените миграции и заполните демо-данные**

```bash
docker compose exec api npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
docker compose exec api npm run seed --workspace apps/api
```

Сид создаёт 5 ресторанов с предложениями и слотами на две недели вперёд.

**4. Откройте мини-апп в Telegram**

Telegram открывает мини-приложения только по HTTPS, поэтому в разработке нужен туннель:

```bash
ngrok http 127.0.0.1:5173
```

Укажите выданный адрес в `WEBAPP_URL` и пересоздайте бота: `docker compose up -d bot`. Затем напишите боту `/start`.

> [!IMPORTANT]
> Направляйте туннель на `127.0.0.1`, а не на `localhost`. На macOS `localhost` сначала резолвится в IPv6 `::1`, и если на порту 5173 запущен другой Vite-сервер, Telegram откроет его.

**5. Станьте персоналом ресторана**

От имени администратора отправьте боту:

```text
/register_restaurant Моё кафе
/add_staff <restaurantId> <telegramUserId> owner
```

После этого мини-апп откроет вам панель ресторана вместо ленты.

---

## Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `BOT_TOKEN` | — | Токен бота от @BotFather. **Обязательна.** |
| `ADMIN_TELEGRAM_IDS` | — | Telegram id администраторов через запятую |
| `WEBAPP_URL` | — | Публичный HTTPS-адрес мини-приложения |
| `APP_TIMEZONE` | `Europe/Moscow` | Таймзона, в которой заданы часы слотов |
| `REMINDER_LEAD_MINUTES` | `120` | За сколько минут до слота напоминать гостю |
| `NO_SHOW_GRACE_MINUTES` | `30` | Через сколько минут после конца слота неотмеченная бронь становится «не пришёл» |
| `SLOT_GENERATION_HORIZON_DAYS` | `14` | На сколько дней вперёд создаются слоты |
| `DATABASE_URL` | см. `.env.example` | Подключение к Postgres внутри Docker-сети |
| `DATABASE_URL_HOST` | см. `.env.example` | Подключение к Postgres с хоста (тесты, Prisma CLI) |
| `POSTGRES_HOST_PORT` | `5433` | Порт Postgres на хосте |
| `API_PORT` / `API_HOST` | `3000` / `0.0.0.0` | Адрес API |

---

## Команды

<details open>
<summary><b>Разработка</b></summary>

| Команда | Что делает |
|---|---|
| `docker compose up -d` | Поднимает Postgres, API, бота и фронт с hot reload |
| `docker compose logs -f bot` | Логи бота и фоновых задач |
| `npm run prisma:migrate` | Создаёт и применяет миграцию (нужен `DATABASE_URL` хоста) |
| `npm run build` | Собирает все пакеты |

</details>

<details>
<summary><b>Команды бота</b></summary>

| Команда | Кто | Что делает |
|---|---|---|
| `/start` | все | Кнопка открытия мини-приложения |
| `/register_restaurant <название>` | админ | Создаёт ресторан и возвращает его id |
| `/add_staff <restaurantId> <userId> [owner\|staff]` | админ | Добавляет сотрудника ресторана |

</details>

<details>
<summary><b>Основные эндпоинты API</b></summary>

| Метод | Путь | Кто |
|---|---|---|
| `GET` | `/offers` | гость |
| `GET` | `/restaurants/:id` | гость |
| `POST` | `/bookings` | гость |
| `GET` | `/bookings/me` | гость |
| `POST` | `/bookings/:id/cancel` | гость |
| `GET` | `/me/role` | все |
| `GET` `POST` | `/restaurant/offers` | персонал |
| `PATCH` | `/restaurant/offers/:id` | персонал |
| `GET` | `/restaurant/bookings?date=` | персонал |
| `POST` | `/restaurant/bookings/check-in` | персонал |
| `PATCH` | `/restaurant/bookings/:id` | персонал |
| `GET` | `/restaurant/stats?from=&days=` | персонал |

Все запросы требуют заголовок `x-telegram-init-data`.

</details>

---

## Структура проекта

```text
.
├── apps
│   ├── api            Fastify: маршруты, бронирование, генерация слотов
│   ├── bot            grammY: команды, планировщик, уведомления, напоминания, неявки
│   └── web            React + Vite: лента, страница ресторана, брони, панель персонала
├── packages
│   ├── db             Prisma: схема, миграции, клиент
│   └── shared         DTO и функции времени слотов
├── docker-compose.yml
└── .env.example
```

---

## Надёжность

Проект рассчитан на одновременные запросы и перезапуски:

- **Никакого овербукинга.** Места списываются одним атомарным `UPDATE … WHERE seatsBooked + n <= seatsTotal`. Конкурентные брони проверены тестом.
- **Прошедшие слоты недоступны.** Сервер сравнивает время слота с текущим в таймзоне ресторана прямо в SQL, поэтому обойти проверку из клиента нельзя.
- **Ровно одно уведомление.** Напоминания и сообщения персоналу сначала атомарно «забираются» в базе, потом отправляются. Дублей нет даже при нескольких экземплярах бота. При сбое сети сообщение уходит повторно, если пользователь заблокировал бота — нет.
- **Отмена освобождает места один раз**, даже если гость нажал кнопку несколько раз подряд.
- **Изоляция ресторанов.** `restaurantId` всегда берётся из записи сотрудника, а не из запроса.

---

## Тесты

Тесты интеграционные и работают с настоящим Postgres из `docker compose`:

```bash
export DATABASE_URL="postgresql://app:app@localhost:5433/restaurant_offpeak?schema=public"

npm test --workspace apps/api
npm test --workspace apps/bot
```

Покрыты проверка `initData`, генерация слотов, бронирование (включая гонки), отмена, панель персонала с изоляцией ресторанов, напоминания, уведомления персоналу и автоотметка неявок. Каждый тест создаёт собственные данные и удаляет их после прогона.

---

<div align="center">
<sub>Сделано с Telegram Mini Apps · TypeScript · любовью к пустым столикам в 15:00</sub>
</div>

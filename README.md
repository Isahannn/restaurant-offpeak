<div align="center">

# TheFood

**Off-peak restaurant discounts, right inside Telegram**

Restaurants fill empty tables with discounts during their quiet hours.<br>
Guests grab a discounted slot in a Telegram Mini App in a couple of taps.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=flat-square&logo=fastify&logoColor=white)
![grammY](https://img.shields.io/badge/grammY-26A5E4?style=flat-square&logo=telegram&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?style=flat-square&logo=docker&logoColor=white)

</div>

---

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Reference](#reference)
- [Project structure](#project-structure)
- [Reliability](#reliability)
- [Tests](#tests)

---

## Features

<table>
<tr>
<td width="50%" valign="top">

### For guests

- Feed with **Now / Today / Tomorrow / All** filters and a best-deals carousel
- Large photo cards with quick time chips — tap a time to book
- Booking in a bottom sheet: day, time, party size, then a code and QR
- Restaurant pages with a full-bleed hero and all offers
- **My bookings**: upcoming and past, cancel until the slot starts
- Telegram reminder before the visit
- A message after each visit mark, with a button to **dispute** it

</td>
<td width="50%" valign="top">

### For restaurants

- Staff panel inside the same Mini App, chosen by role
- **Today** — check guests in by code, live list without reloads
- **Seats** — change capacity per slot or close whole hours for a banquet
- **Offers** — create and **edit** offers, days, hours, several discount windows
- **Stats** — fill rate, visits, no-shows and disputed marks per day
- Telegram message for every new booking
- Unmarked bookings become no-shows automatically

</td>
</tr>
</table>

---

## How it works

```mermaid
flowchart LR
    Guest(["Guest"]) -->|Telegram| Bot
    Staff(["Staff"]) -->|Telegram| Bot
    Bot["Bot · grammY"] -->|WebApp button| Web["Mini App · React + Vite"]
    Web -->|"/api · initData"| API["API · Fastify"]
    API -->|"SSE · live updates"| Web
    API --> DB[("PostgreSQL")]
    DB -->|"NOTIFY booking_events"| API
    Bot -->|"background jobs"| DB
```

| Service | What it does |
|---|---|
| **`apps/web`** | The Mini App. Guests get the feed and their bookings; staff get the restaurant panel. Screens are lazy-loaded, so guests never download staff code. |
| **`apps/api`** | REST API. Every request is signed with Telegram `initData` (HMAC-SHA256), and staff only ever see their own restaurant. Streams live booking events to the panel over Server-Sent Events and tops up slots 14 days ahead every hour. |
| **`apps/bot`** | Mini App button, admin commands and four background jobs that run every minute: staff notifications, guest reminders, visit messages and automatic no-shows. |
| **`packages/db`** | Prisma schema, migrations and client. |
| **`packages/shared`** | Shared DTO types and time-zone-aware slot time helpers. |

**Data model:** `Restaurant` → `Offer` (days, hours, discount windows, exceptions) → `Slot` (a concrete date and hour with a seat limit) → `Booking` (guest, code, status).

---

## Quick start

> You need **Docker**, **Node.js 20+** and a bot token from [@BotFather](https://t.me/BotFather).

**1. Configure the environment**

```bash
cp .env.example .env
```

Fill in at least `BOT_TOKEN`, `ADMIN_TELEGRAM_IDS` (get your id from [@userinfobot](https://t.me/userinfobot)) and `WEBAPP_URL`.

**2. Start the services**

```bash
npm install
docker compose up -d --build
```

**3. Apply migrations and load demo data**

```bash
docker compose exec api npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
docker compose restart api bot
docker compose exec api npm run seed --workspace apps/api
```

The seed creates 5 restaurants with offers and slots for the next two weeks.

> [!NOTE]
> The containers generate the Prisma client when they start. Restart them (`docker compose restart api bot`) after every new migration, otherwise the code sees new columns that the database client doesn't know about.

**4. Open the Mini App in Telegram**

Telegram only opens Mini Apps over HTTPS, so development needs a tunnel:

```bash
ngrok http 127.0.0.1:5173
```

Put the issued URL into `WEBAPP_URL`, recreate the bot with `docker compose up -d bot`, and send `/start` to your bot.

> [!IMPORTANT]
> Point the tunnel at `127.0.0.1`, not `localhost`. On macOS `localhost` resolves to IPv6 `::1` first, and if another Vite dev server listens on port 5173 there, Telegram will open that one instead.

**5. Become restaurant staff**

As an admin, send the bot:

```text
/register_restaurant My Cafe
/add_staff <restaurantId> <telegramUserId> owner
```

The Mini App will then open the restaurant panel instead of the guest feed.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `BOT_TOKEN` | — | Bot token from @BotFather. **Required.** |
| `ADMIN_TELEGRAM_IDS` | — | Comma-separated Telegram ids allowed to run admin commands |
| `WEBAPP_URL` | — | Public HTTPS URL of the Mini App |
| `APP_TIMEZONE` | `Europe/Moscow` | Time zone the slot hours are expressed in |
| `REMINDER_LEAD_MINUTES` | `120` | How long before a slot the guest is reminded |
| `NO_SHOW_GRACE_MINUTES` | `30` | Minutes after a slot ends before an unmarked booking becomes a no-show |
| `SLOT_GENERATION_HORIZON_DAYS` | `14` | How many days ahead slots are created |
| `DATABASE_URL` | see `.env.example` | Postgres connection inside the Docker network |
| `DATABASE_URL_HOST` | see `.env.example` | Postgres connection from the host (tests, Prisma CLI) |
| `POSTGRES_HOST_PORT` | `5433` | Postgres port on the host |
| `API_PORT` / `API_HOST` | `3000` / `0.0.0.0` | API address |

---

## Reference

<details open>
<summary><b>Development commands</b></summary>

| Command | What it does |
|---|---|
| `docker compose up -d` | Starts Postgres, API, bot and the web app with hot reload |
| `docker compose logs -f bot` | Bot and background job logs |
| `npm run prisma:migrate` | Creates and applies a migration (needs the host `DATABASE_URL`) |
| `npm run build` | Builds every package |

</details>

<details>
<summary><b>Bot commands</b></summary>

| Command | Who | What it does |
|---|---|---|
| `/start` | everyone | Button that opens the Mini App |
| `/register_restaurant <name>` | admin | Creates a restaurant and returns its id |
| `/add_staff <restaurantId> <userId> [owner\|staff]` | admin | Adds a staff member to a restaurant |

</details>

<details>
<summary><b>API endpoints</b></summary>

| Method | Path | Who |
|---|---|---|
| `GET` | `/offers` | guest |
| `GET` | `/restaurants/:id` | guest |
| `POST` | `/bookings` | guest |
| `GET` | `/bookings/me` | guest |
| `POST` | `/bookings/:id/cancel` | guest |
| `GET` | `/me/role` | everyone |
| `GET` `POST` | `/restaurant/offers` | staff |
| `PATCH` | `/restaurant/offers/:id` | staff — toggle or full edit |
| `GET` | `/restaurant/bookings?date=` | staff |
| `POST` | `/restaurant/bookings/check-in` | staff |
| `PATCH` | `/restaurant/bookings/:id` | staff |
| `GET` | `/restaurant/slots?date=` | staff |
| `PATCH` | `/restaurant/slots/:id` | staff — one slot's seats |
| `PATCH` | `/restaurant/slots` | staff — close or reopen an hour range |
| `GET` | `/restaurant/stats?from=&days=` | staff |
| `GET` | `/restaurant/events` | staff — live updates (SSE) |

Every request needs the `x-telegram-init-data` header.

</details>

---

## Project structure

```text
.
├── apps
│   ├── api            Fastify: routes, booking, slot generation, live events
│   ├── bot            grammY: commands, scheduler, notifications, reminders, no-shows
│   └── web            React + Vite: feed, restaurant page, bookings, staff panel
├── packages
│   ├── db             Prisma: schema, migrations, client
│   └── shared         DTOs and slot time helpers
├── docker-compose.yml
└── .env.example
```

---

## Reliability

Built for concurrent requests, restarts and people who might bend the rules:

- **No overbooking.** Seats are taken with a single atomic `UPDATE … WHERE seatsBooked + n <= seatsTotal`; concurrent bookings are covered by a test.
- **Started slots can't be booked.** The server compares the slot time with "now" in the restaurant's time zone inside SQL, so the client can't get around it.
- **Honest visit marks.** "Arrived" can only be set from 30 minutes before the slot to the end of that day, and "no-show" only after the start. Staff see masked codes (`••••AB`), so check-in by code needs the guest. Every mark is sent to the guest, who can dispute it; disputed marks are counted separately.
- **Capacity changes are race-free.** Seats can never drop below what is already booked — the check lives in the `UPDATE` itself.
- **Editing an offer respects guests.** Booked slots keep the time and discount the guest agreed to; empty slots follow the new schedule; seats changed by hand (a closed banquet) are kept.
- **Exactly one message.** Reminders, staff notifications and visit messages are claimed atomically before sending — no duplicates even with several bot instances. Network failures are retried; blocked chats are not.
- **Live updates that recover.** The panel reconnects when the event stream goes silent (a proxy can keep a dead socket open) and resyncs anything it missed.
- **Restaurant isolation.** `restaurantId` always comes from the staff record, never from the request.

---

## Tests

Integration tests run against the real Postgres from `docker compose`:

```bash
export DATABASE_URL="postgresql://app:app@localhost:5433/restaurant_offpeak?schema=public"

npm test --workspace apps/api
npm test --workspace apps/bot
```

They cover `initData` checks, slot generation and offer edits, booking (including races), cancellation, visit windows and check-in, slot capacity, restaurant isolation, live events, reminders, staff notifications, visit messages with disputes, and automatic no-shows.

> [!WARNING]
> The tests use the same database as the running app. Each test creates its own data far in the future and removes it afterwards, and any job that writes across the whole table is scoped to the test's own restaurant. Keep it that way when adding tests.

---

<div align="center">
<sub>Built with Telegram Mini Apps · TypeScript · a soft spot for empty tables at 3 pm</sub>
</div>

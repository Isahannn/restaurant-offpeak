import { prisma } from "@app/db";
import { generateSlotsJob } from "../offers/generateSlotsJob.js";

interface SeedDiscountWindow {
  startTime: string;
  endTime: string;
}

interface SeedOffer {
  title: string;
  discountPercent: number;
  exceptions: string[];
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  seatsPerSlot: number;
  /** Sub-ranges within [startTime, endTime) where the discount applies.
   * Empty means the whole window is discounted. */
  discountWindows: SeedDiscountWindow[];
}

interface SeedRestaurant {
  name: string;
  imageUrl: string;
  description: string;
  offers: SeedOffer[];
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const SEED_RESTAURANTS: SeedRestaurant[] = [
  {
    name: "Demo Trattoria",
    imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
    description:
      "Итальянская кухня: паста ручной работы и пицца на дровах. Тёплая атмосфера семейной траттории в центре города.",
    offers: [
      {
        title: "Столик на обед и ужин",
        discountPercent: 25,
        exceptions: ["напитки"],
        daysOfWeek: ALL_DAYS,
        startTime: "11:00",
        endTime: "22:00",
        seatsPerSlot: 8,
        discountWindows: [{ startTime: "11:00", endTime: "14:00" }],
      },
    ],
  },
  {
    name: "Sakura Sushi",
    imageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80",
    description:
      "Суши и роллы от шеф-повара из Осаки. Свежая рыба каждый день, аутентичная японская подача.",
    offers: [
      {
        title: "Столик весь день",
        discountPercent: 20,
        exceptions: ["алкоголь", "сет-меню"],
        daysOfWeek: ALL_DAYS,
        startTime: "12:00",
        endTime: "22:00",
        seatsPerSlot: 6,
        // Two separate weak periods: lunch lull and the slow late-evening stretch.
        discountWindows: [
          { startTime: "12:00", endTime: "14:00" },
          { startTime: "20:00", endTime: "22:00" },
        ],
      },
    ],
  },
  {
    name: "Burger Point",
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
    description:
      "Авторские бургеры на мраморной говядине и картофель фри с соусами собственного приготовления.",
    offers: [
      {
        title: "Столик весь день",
        discountPercent: 30,
        exceptions: [],
        daysOfWeek: ALL_DAYS,
        startTime: "11:00",
        endTime: "23:00",
        seatsPerSlot: 10,
        discountWindows: [{ startTime: "13:00", endTime: "15:00" }],
      },
    ],
  },
  {
    name: "La Pasta",
    imageUrl: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&q=80",
    description:
      "Лёгкие завтраки и бранчи: боулы, свежая выпечка и фильтр-кофе. Светлое пространство у большого окна.",
    offers: [
      {
        title: "Завтрак и обед",
        discountPercent: 15,
        exceptions: ["кофе"],
        daysOfWeek: ALL_DAYS,
        startTime: "09:00",
        endTime: "16:00",
        seatsPerSlot: 5,
        discountWindows: [{ startTime: "10:00", endTime: "12:00" }],
      },
    ],
  },
  {
    name: "Куриный Двор",
    imageUrl: "https://images.unsplash.com/photo-1562967914-608f82629710?w=800&q=80",
    description:
      "Жареная курица по фирменному рецепту со специями, домашний соус и хрустящая корочка.",
    offers: [
      {
        title: "Столик днём и вечером",
        discountPercent: 35,
        exceptions: ["напитки"],
        daysOfWeek: ALL_DAYS,
        startTime: "12:00",
        endTime: "23:00",
        seatsPerSlot: 4,
        discountWindows: [{ startTime: "21:00", endTime: "23:00" }],
      },
    ],
  },
];

function windowsEqual(a: SeedDiscountWindow[], b: SeedDiscountWindow[]): boolean {
  if (a.length !== b.length) return false;
  const key = (w: SeedDiscountWindow) => `${w.startTime}-${w.endTime}`;
  const sortedA = [...a].map(key).sort();
  const sortedB = [...b].map(key).sort();
  return sortedA.every((w, i) => w === sortedB[i]);
}

async function main() {
  for (const seedRestaurant of SEED_RESTAURANTS) {
    let restaurant = await prisma.restaurant.findFirst({
      where: { name: seedRestaurant.name },
    });

    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: {
          name: seedRestaurant.name,
          imageUrl: seedRestaurant.imageUrl,
          description: seedRestaurant.description,
        },
      });
      console.log(`Created restaurant: ${restaurant.name} (${restaurant.id})`);
    } else {
      if (
        restaurant.imageUrl !== seedRestaurant.imageUrl ||
        restaurant.description !== seedRestaurant.description
      ) {
        restaurant = await prisma.restaurant.update({
          where: { id: restaurant.id },
          data: { imageUrl: seedRestaurant.imageUrl, description: seedRestaurant.description },
        });
      }
      console.log(`Using existing restaurant: ${restaurant.name} (${restaurant.id})`);
    }

    for (const seedOffer of seedRestaurant.offers) {
      const { discountWindows, ...offerFields } = seedOffer;

      let offer = await prisma.offer.findFirst({
        where: { restaurantId: restaurant.id, title: seedOffer.title },
        include: { discountWindows: true },
      });

      if (!offer) {
        offer = await prisma.offer.create({
          data: {
            restaurantId: restaurant.id,
            active: true,
            ...offerFields,
            discountWindows: { create: discountWindows },
          },
          include: { discountWindows: true },
        });
        console.log(`  Created offer: ${offer.title} (${offer.id})`);
      } else {
        const scheduleChanged =
          offer.startTime !== offerFields.startTime ||
          offer.endTime !== offerFields.endTime ||
          offer.discountPercent !== offerFields.discountPercent ||
          JSON.stringify(offer.daysOfWeek) !== JSON.stringify(offerFields.daysOfWeek) ||
          !windowsEqual(offer.discountWindows, discountWindows);

        if (scheduleChanged) {
          await prisma.booking.deleteMany({ where: { slot: { offerId: offer.id } } });
          await prisma.slot.deleteMany({ where: { offerId: offer.id } });
          await prisma.discountWindow.deleteMany({ where: { offerId: offer.id } });
          offer = await prisma.offer.update({
            where: { id: offer.id },
            data: { ...offerFields, discountWindows: { create: discountWindows } },
            include: { discountWindows: true },
          });
          console.log(`  Updated offer schedule and regenerated slots: ${offer.title} (${offer.id})`);
        } else {
          console.log(`  Using existing offer: ${offer.title} (${offer.id})`);
        }
      }
    }
  }

  const horizonDays = Number(process.env.SLOT_GENERATION_HORIZON_DAYS ?? 14);
  const created = await generateSlotsJob({ horizonDays });
  console.log(`Generated ${created} new slot(s) across all offers for the next ${horizonDays} day(s).`);

  const totalOffers = await prisma.offer.count();
  const totalSlots = await prisma.slot.count();
  console.log(`Database now has ${totalOffers} offer(s) and ${totalSlots} slot(s) total.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

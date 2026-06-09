import { PrismaClient, MealType, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("123456", 10);

  const customer = await prisma.user.upsert({
    where: { email: "customer@test.com" },
    update: {},
    create: {
      email: "customer@test.com",
      passwordHash: hash,
      name: "عميل تجريبي",
      role: Role.CUSTOMER,
      phone: "0500000001",
    },
  });

  const r1User = await prisma.user.upsert({
    where: { email: "burger@test.com" },
    update: {},
    create: {
      email: "burger@test.com",
      passwordHash: hash,
      name: "برجر هاوس",
      role: Role.RESTAURANT,
      restaurant: {
        create: {
          name: "برجر هاوس",
          description: "أفضل برجر",
          lat: 24.7136,
          lng: 46.6753,
          address: "الرياض",
        },
      },
    },
    include: { restaurant: true },
  });

  const r2User = await prisma.user.upsert({
    where: { email: "grill@test.com" },
    update: {},
    create: {
      email: "grill@test.com",
      passwordHash: hash,
      name: "مشويات الوادي",
      role: Role.RESTAURANT,
      restaurant: {
        create: {
          name: "مشويات الوادي",
          lat: 24.72,
          lng: 46.68,
          address: "الرياض",
        },
      },
    },
    include: { restaurant: true },
  });

  await prisma.user.upsert({
    where: { email: "captain@test.com" },
    update: {},
    create: {
      email: "captain@test.com",
      passwordHash: hash,
      name: "كابتن أحمد",
      role: Role.CAPTAIN,
      phone: "0500000002",
      captain: { create: { vehicle: "دراجة نارية", isOnline: true, lat: 24.715, lng: 46.67 } },
    },
  });

  const r1 = r1User.restaurant!;
  const r2 = r2User.restaurant!;

  await prisma.product.createMany({
    data: [
      {
        restaurantId: r1.id,
        name: "برجر كلاسيك",
        price: 25,
        category: "برجر",
        mealType: MealType.LUNCH,
      },
      {
        restaurantId: r1.id,
        name: "فطور برجر",
        price: 18,
        category: "برجر",
        mealType: MealType.BREAKFAST,
      },
      {
        restaurantId: r2.id,
        name: "برجر مشوي",
        price: 28,
        category: "برجر",
        mealType: MealType.DINNER,
      },
      {
        restaurantId: r2.id,
        name: "شاورما غداء",
        price: 22,
        category: "شاورما",
        mealType: MealType.LUNCH,
      },
    ],
    skipDuplicates: true,
  });

  console.log("تم البذر:", { customer: customer.email });
}

main()
  .finally(() => prisma.$disconnect());

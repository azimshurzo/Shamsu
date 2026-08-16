import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: { email: "admin@shamsu.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@shamsu.com",
      passwordHash: adminPassword,
      role: "ADMIN",
      subscriptionStatus: "ACTIVE",
    },
  });

  const defaultPricing = [
    { key: "pricing_tier_1_max_actions", value: "5" },
    { key: "pricing_tier_1_price_bdt", value: "2" },
    { key: "pricing_tier_2_max_actions", value: "10" },
    { key: "pricing_tier_2_price_bdt", value: "3" },
    { key: "pricing_tier_3_max_actions", value: "20" },
    { key: "pricing_tier_3_price_bdt", value: "4" },
    { key: "pricing_tier_4_price_bdt", value: "5" },
    { key: "free_tier_daily_attempts", value: "5" },
  ];

  for (const setting of defaultPricing) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  const plans = [
    { id: "plan-weekly", planName: "Weekly", priceBdt: 100, durationDays: 7 },
    { id: "plan-monthly", planName: "Monthly", priceBdt: 300, durationDays: 30 },
    { id: "plan-yearly", planName: "Yearly", priceBdt: 2500, durationDays: 365 },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: {},
      create: plan,
    });
  }

  console.log("Database seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

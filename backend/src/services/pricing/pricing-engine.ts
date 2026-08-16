import { prisma } from "../../index";

interface PricingTier {
  maxActions: number | null;
  priceBdt: number;
}

export async function getPricingTiers(): Promise<PricingTier[]> {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { startsWith: "pricing_tier_" } },
  });

  const tiers: PricingTier[] = [];
  const tierMap: Record<string, { max?: number; price?: number }> = {};

  for (const s of settings) {
    const parts = s.key.split("_");
    const tierNum = parts[2];
    if (!tierMap[tierNum]) tierMap[tierNum] = {};
    if (parts.includes("max")) tierMap[tierNum].max = parseInt(s.value);
    if (parts.includes("price")) tierMap[tierNum].price = parseFloat(s.value);
  }

  for (const key of Object.keys(tierMap).sort()) {
    const tier = tierMap[key];
    tiers.push({ maxActions: tier.max || null, priceBdt: tier.price || 2 });
  }

  return tiers;
}

export async function calculatePrice(stepCount: number): Promise<number> {
  const tiers = await getPricingTiers();

  for (const tier of tiers) {
    if (tier.maxActions !== null && stepCount <= tier.maxActions) {
      return tier.priceBdt;
    }
  }

  return tiers[tiers.length - 1]?.priceBdt || 5;
}

export async function canUserCreateApi(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  // Active subscribers get unlimited API creation
  if (
    user.subscriptionStatus === "ACTIVE" &&
    user.subscriptionExpiresAt &&
    user.subscriptionExpiresAt > new Date()
  ) {
    return true;
  }

  const resetSetting = await prisma.systemSetting.findUnique({
    where: { key: "free_tier_daily_attempts" },
  });
  const maxAttempts = parseInt(resetSetting?.value || "5");

  const now = new Date();
  const lastReset = user.apiAttemptsResetAt || user.createdAt;

  if (
    lastReset.toDateString() !== now.toDateString() ||
    user.apiCreationAttempts >= maxAttempts
  ) {
    if (lastReset.toDateString() !== now.toDateString()) {
      await prisma.user.update({
        where: { id: userId },
        data: { apiCreationAttempts: 0, apiAttemptsResetAt: now },
      });
      return true;
    }
    return false;
  }

  return true;
}

export async function incrementAttemptCount(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { apiCreationAttempts: { increment: 1 } },
  });
}

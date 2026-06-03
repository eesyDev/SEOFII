import { lemonSqueezySetup, createCheckout } from "@lemonsqueezy/lemonsqueezy.js";

lemonSqueezySetup({ apiKey: process.env.LEMON_API_KEY! });

export interface PlanConfig {
  id: "STARTER" | "PRO";
  name: string;
  price: number;
  reportsLimit: number | null;
  variantId: string;
  features: string[];
}

export const PLANS: PlanConfig[] = [
  {
    id: "STARTER",
    name: "Starter",
    price: 25,
    reportsLimit: 4,
    variantId: process.env.LEMON_VARIANT_STARTER ?? "",
    features: [
      "4 отчёта в месяц",
      "Полный анализ конкурентов",
      "Готовый контент для копипаста",
      "FAQ и schema.org разметка",
      "Email поддержка",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: 50,
    reportsLimit: 50,
    variantId: process.env.LEMON_VARIANT_PRO ?? "",
    features: [
      "10 отчётов в месяц",
      "Полный анализ конкурентов",
      "Готовый контент для копипаста",
      "FAQ и schema.org разметка",
      "Приоритетная поддержка",
    ],
  },
];

export async function createCheckoutUrl(
  variantId: string,
  userEmail: string,
  userId: string
): Promise<string> {
  const storeId = process.env.LEMON_STORE_ID!;

  const checkout = await createCheckout(storeId, variantId, {
    checkoutData: {
      email: userEmail,
      custom: { user_id: userId },
    },
    checkoutOptions: {
      embed: false,
      media: false,
    },
    productOptions: {
      redirectUrl: `${process.env.AUTH_URL}/billing?success=1`,
      receiptButtonText: "Вернуться в SEOBrief",
    },
  });

  return checkout.data?.data.attributes.url ?? "";
}

import { lemonSqueezySetup, createCheckout } from "@lemonsqueezy/lemonsqueezy.js";

lemonSqueezySetup({ apiKey: process.env.LEMON_API_KEY! });

export interface PlanConfig {
  id: "STARTER" | "PRO";
  name: string;
  price: number;
  reportsLimit: number;
  variantId: string;
  features: string[];
}

export const PLANS: PlanConfig[] = [
  {
    id: "STARTER",
    name: "Starter",
    price: 19,
    reportsLimit: 30,
    variantId: process.env.LEMON_VARIANT_STARTER ?? "",
    features: [
      "30 отчётов в месяц",
      "Полный анализ конкурентов",
      "Экспорт результатов",
      "Email поддержка",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: 49,
    reportsLimit: -1,
    variantId: process.env.LEMON_VARIANT_PRO ?? "",
    features: [
      "Безлимитные отчёты",
      "Приоритетная генерация",
      "API доступ",
      "Командный доступ",
      "White-label отчёты",
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

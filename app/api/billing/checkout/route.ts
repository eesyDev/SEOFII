import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createCheckoutUrl, PLANS } from "@/lib/lemonsqueezy";

const schema = z.object({
  planId: z.enum(["STARTER", "PRO"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверный план" }, { status: 422 });
  }

  const plan = PLANS.find((p) => p.id === parsed.data.planId);
  if (!plan) return NextResponse.json({ error: "План не найден" }, { status: 404 });

  const url = await createCheckoutUrl(plan.variantId, session.user.email, session.user.id);

  return NextResponse.json({ url });
}

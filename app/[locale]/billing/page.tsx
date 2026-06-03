import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Zap } from "lucide-react";
import { PLANS } from "@/lib/lemonsqueezy";
import CheckoutButton from "@/components/billing/CheckoutButton";
import SuccessBanner from "@/components/billing/SuccessBanner";

const FREE_FEATURES = [
  "1 отчёт",
  "Анализ конкурентов",
  "Список задач (без готового контента)",
];

const AGENCY_PLAN = {
  name: "Agency",
  price: 120,
  reportsLimit: 30,
  features: [
    "30 отчётов в месяц",
    "Всё из Pro",
    "Командный доступ",
    "White-label отчёты",
    "Приоритетная поддержка",
  ],
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      plan: true,
      reportsUsed: true,
      reportsLimit: true,
      subscription: {
        select: { status: true, currentPeriodEnd: true, lemonSqueezyId: true },
      },
    },
  });

  if (!user) redirect("/login");

  const currentPlan = user.plan;
  const isSuccess = params.success === "1";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Биллинг</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Управляй подпиской и тарифом</p>
      </div>

      {isSuccess && <SuccessBanner />}

      {/* Текущий тариф */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Текущий тариф</h2>
        <Separator />
        <div className="rounded-xl border bg-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold capitalize">{currentPlan.toLowerCase()}</span>
              {currentPlan !== "FREE" && (
                <Badge variant="default" className="text-xs">Активен</Badge>
              )}
            </div>
            {user.subscription?.currentPeriodEnd && (
              <p className="text-sm text-muted-foreground">
                Следующее списание:{" "}
                {new Date(user.subscription.currentPeriodEnd).toLocaleDateString("ru-RU")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Отчётов использовано</span>
              <span className="font-medium tabular-nums">
                {user.reportsUsed} / {user.reportsLimit == null ? "∞" : user.reportsLimit}
              </span>
            </div>
            {user.reportsLimit != null && (
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min((user.reportsUsed / user.reportsLimit) * 100, 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Тарифы */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Планы</h2>
        <Separator />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Free */}
          <div className={`rounded-xl border bg-background p-5 flex flex-col gap-4 ${currentPlan === "FREE" ? "border-primary ring-1 ring-primary" : ""}`}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">Free</span>
                {currentPlan === "FREE" && <Badge variant="secondary" className="text-xs">Текущий</Badge>}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">$0</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Попробуй без рисков</p>
            </div>
            <ul className="space-y-2 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="h-9" /> {/* placeholder для выравнивания */}
          </div>

          {/* Starter, Pro */}
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isHighlight = plan.id === "STARTER";

            return (
              <div
                key={plan.id}
                className={`rounded-xl border bg-background p-5 flex flex-col gap-4 ${
                  isCurrent
                    ? "border-primary ring-1 ring-primary"
                    : isHighlight
                    ? "border-primary/40"
                    : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{plan.name}</span>
                      {isHighlight && !isCurrent && (
                        <Badge className="text-xs gap-1">
                          <Zap className="h-3 w-3" /> Популярный
                        </Badge>
                      )}
                    </div>
                    {isCurrent && <Badge variant="secondary" className="text-xs">Текущий</Badge>}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground text-sm">/мес</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.reportsLimit == null ? "Безлимитные отчёты" : `${plan.reportsLimit} отчётов / мес`}
                  </p>
                </div>

                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <CheckoutButton
                  planId={plan.id}
                  isCurrent={isCurrent}
                  isHighlight={isHighlight}
                />
              </div>
            );
          })}

          {/* Agency */}
          <div className="rounded-xl border bg-background p-5 flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">{AGENCY_PLAN.name}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">${AGENCY_PLAN.price}</span>
                <span className="text-muted-foreground text-sm">/мес</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{AGENCY_PLAN.reportsLimit} отчётов / мес</p>
            </div>
            <ul className="space-y-2 flex-1">
              {AGENCY_PLAN.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="text-xs text-center text-muted-foreground py-2 border rounded-lg">
              Скоро — напиши нам
            </div>
          </div>
        </div>
      </section>

      {/* Управление подпиской */}
      {user.subscription?.lemonSqueezyId && currentPlan !== "FREE" && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Управление подпиской</h2>
          <Separator />
          <p className="text-sm text-muted-foreground">
            Для отмены подписки или получения счётов — обратись в поддержку или управляй подпиской
            через LemonSqueezy.
          </p>
        </section>
      )}
    </div>
  );
}

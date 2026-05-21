import { TrendingUp, Zap, Clock, MousePointerClick, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AnalyticsSummary } from "@/lib/analytics";

function fmtMonths(months: number | null): string {
  if (months === null) return "н/д";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} мес.`;
  if (m === 0) return `${y} ${y === 1 ? "год" : y < 5 ? "года" : "лет"}`;
  return `${y} ${y === 1 ? "год" : y < 5 ? "года" : "лет"} ${m} мес.`;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold tabular-nums leading-none ${accent ?? ""}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({
  summary,
  hasGsc,
}: {
  summary: AnalyticsSummary;
  hasGsc: boolean;
}) {
  const cards = [
    {
      icon: TrendingUp,
      label: "Gap-ключей",
      value: summary.totalGapKeywords.toLocaleString(),
      sub: "конкуренты ранжируются, мы нет",
      accent: summary.totalGapKeywords > 0 ? "text-blue-600 dark:text-blue-400" : undefined,
    },
    {
      icon: Zap,
      label: "Quick wins",
      value: summary.quickWinsCount.toLocaleString(),
      sub: "позиции 5–20 в GSC",
      accent: summary.quickWinsCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined,
    },
    {
      icon: Search,
      label: "Потенциал трафика",
      value: summary.trafficPotential.toLocaleString(),
      sub: "volume топ-20 gap-ключей / мес",
    },
    {
      icon: Clock,
      label: "Ср. возраст конкурентов",
      value: fmtMonths(summary.avgCompetitorDomainAgeMonths),
      sub: "средний возраст домена",
    },
    ...(hasGsc
      ? [
          {
            icon: MousePointerClick,
            label: "Кликов из GSC",
            value: summary.gscTotalClicks.toLocaleString(),
            sub: `${summary.gscTotalQueries} запросов · ${summary.gscTotalImpressions.toLocaleString()} показов`,
          },
        ]
      : []),
  ];

  return (
    <div className={`grid gap-3 ${hasGsc ? "sm:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
      {cards.map((c) => (
        <MetricCard key={c.label} {...c} />
      ))}
    </div>
  );
}

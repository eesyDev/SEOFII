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

function gapInsight(n: number): string {
  if (n === 0) return "Семантика покрыта — явных пробелов не найдено";
  if (n <= 5) return "Несколько тем которые стоит закрыть контентом";
  if (n <= 20) return "Конкуренты ранжируются по темам которых у вас нет";
  return "Большой пробел — конкуренты охватывают намного больше тем";
}

function quickWinsInsight(n: number): string {
  if (n === 0) return "Пока нет страниц на грани топ-10 — начните с задач ниже";
  if (n <= 3) return "Небольшие правки на этих страницах дадут быстрый результат";
  return "Отличная возможность — эти страницы можно поднять быстро";
}

function trafficInsight(n: number): string {
  if (n === 0) return "Нет данных для оценки потенциала";
  if (n < 1000) return "Небольшая ниша — конкуренция ниже, проще занять топ";
  if (n < 10000) return "Хороший объём — стоит бороться за эти позиции";
  return "Этот трафик сейчас идёт к конкурентам, а не к вам";
}

function ageInsight(months: number | null): string {
  if (months === null) return "Возраст конкурентов неизвестен";
  if (months < 12) return "Ниша молодая — хорошие шансы занять топ";
  if (months < 36) return "Конкуренты не старожилы — можно обойти качественным контентом";
  if (months < 72) return "Конкуренты в топе давно — но их можно обойти контентом";
  return "Сильные конкуренты — ставка на уникальность и экспертность";
}

function clicksInsight(clicks: number): string {
  if (clicks === 0) return "Сайт пока не получает трафик из поиска — есть куда расти";
  if (clicks < 100) return "Трафик минимальный — правильные правки дадут быстрый рост";
  if (clicks < 1000) return "Есть базовый трафик — quick wins ускорят рост";
  return "Хороший базовый трафик — оптимизация даст ощутимый прирост";
}

function MetricCard({
  icon: Icon,
  label,
  value,
  insight,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  insight: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold tabular-nums leading-none ${accent ?? ""}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{insight}</p>
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
      insight: gapInsight(summary.totalGapKeywords),
      accent: summary.totalGapKeywords > 0 ? "text-blue-600 dark:text-blue-400" : undefined,
    },
    {
      icon: Zap,
      label: "Quick wins",
      value: summary.quickWinsCount.toLocaleString(),
      insight: quickWinsInsight(summary.quickWinsCount),
      accent: summary.quickWinsCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined,
    },
    {
      icon: Search,
      label: "Потенциал трафика",
      value: summary.trafficPotential.toLocaleString(),
      insight: trafficInsight(summary.trafficPotential),
    },
    {
      icon: Clock,
      label: "Ср. возраст конкурентов",
      value: fmtMonths(summary.avgCompetitorDomainAgeMonths),
      insight: ageInsight(summary.avgCompetitorDomainAgeMonths),
    },
    ...(hasGsc
      ? [
          {
            icon: MousePointerClick,
            label: "Кликов из GSC",
            value: summary.gscTotalClicks.toLocaleString(),
            insight: clicksInsight(summary.gscTotalClicks),
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

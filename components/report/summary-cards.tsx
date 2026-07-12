import { useLocale } from "next-intl";
import { TrendingUp, Zap, Clock, MousePointerClick, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AnalyticsSummary } from "@/lib/analytics";

function fmtMonths(months: number | null, en: boolean): string {
  if (months === null) return en ? "n/a" : "н/д";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return en ? `${m} mo` : `${m} мес.`;
  if (m === 0) return en ? `${y} yr` : `${y} ${y === 1 ? "год" : y < 5 ? "года" : "лет"}`;
  return en ? `${y} yr ${m} mo` : `${y} ${y === 1 ? "год" : y < 5 ? "года" : "лет"} ${m} мес.`;
}

function gapInsight(n:  number, en: boolean): string {
  if (n === 0) return en ? "Semantics covered — no obvious gaps" : "Семантика покрыта — явных пробелов не найдено";
  if (n <= 5) return en ? "A few topics worth covering with content" : "Несколько тем которые стоит закрыть контентом";
  if (n <= 20) return en ? "Competitors rank for topics you don\u2019t cover" : "Конкуренты ранжируются по темам которых у вас нет";
  return en ? "Big gap — competitors cover far more topics" : "Большой пробел — конкуренты охватывают намного больше тем";
}

function quickWinsInsight(n:  number, en: boolean): string {
  if (n === 0) return en ? "No pages near top-10 yet — start with the tasks below" : "Пока нет страниц на грани топ-10 — начните с задач ниже";
  if (n <= 3) return en ? "Small tweaks to these pages will pay off fast" : "Небольшие правки на этих страницах дадут быстрый результат";
  return en ? "Great opportunity — these pages can climb quickly" : "Отличная возможность — эти страницы можно поднять быстро";
}

function trafficInsight(n:  number, en: boolean): string {
  if (n === 0) return en ? "Not enough data to estimate potential" : "Нет данных для оценки потенциала";
  if (n < 1000) return en ? "Small niche — less competition, easier to rank" : "Небольшая ниша — конкуренция ниже, проще занять топ";
  if (n < 10000) return en ? "Solid volume — worth fighting for" : "Хороший объём — стоит бороться за эти позиции";
  return en ? "This traffic currently goes to competitors, not you" : "Этот трафик сейчас идёт к конкурентам, а не к вам";
}

function ageInsight(months:  number | null, en: boolean): string {
  if (months === null) return en ? "Competitor age unknown" : "Возраст конкурентов неизвестен";
  if (months < 12) return en ? "Young niche — good chances to rank" : "Ниша молодая — хорошие шансы занять топ";
  if (months < 36) return en ? "Competitors aren\u2019t veterans — quality content can win" : "Конкуренты не старожилы — можно обойти качественным контентом";
  if (months < 72) return en ? "Competitors have held the top for a while — still beatable" : "Конкуренты в топе давно — но их можно обойти контентом";
  return en ? "Strong competitors — bet on uniqueness and expertise" : "Сильные конкуренты — ставка на уникальность и экспертность";
}

function clicksInsight(clicks:  number, en: boolean): string {
  if (clicks === 0) return en ? "No search traffic yet — room to grow" : "Сайт пока не получает трафик из поиска — есть куда расти";
  if (clicks < 100) return en ? "Minimal traffic — the right fixes bring fast growth" : "Трафик минимальный — правильные правки дадут быстрый рост";
  if (clicks < 1000) return en ? "Baseline traffic in place — quick wins will speed it up" : "Есть базовый трафик — quick wins ускорят рост";
  return en ? "Good baseline traffic — optimization will add a real boost" : "Хороший базовый трафик — оптимизация даст ощутимый прирост";
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
  const en = useLocale() === "en";
  const cards = [
    {
      icon: TrendingUp,
      label: en ? "Gap keywords" : "Gap-ключей",
      value: summary.totalGapKeywords.toLocaleString(),
      insight: gapInsight(summary.totalGapKeywords, en),
      accent: summary.totalGapKeywords > 0 ? "text-blue-600 dark:text-blue-400" : undefined,
    },
    {
      icon: Zap,
      label: "Quick wins",
      value: summary.quickWinsCount.toLocaleString(),
      insight: quickWinsInsight(summary.quickWinsCount, en),
      accent: summary.quickWinsCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined,
    },
    {
      icon: Search,
      label: en ? "Traffic potential" : "Потенциал трафика",
      value: summary.trafficPotential.toLocaleString(),
      insight: trafficInsight(summary.trafficPotential, en),
    },
    {
      icon: Clock,
      label: en ? "Avg. competitor age" : "Ср. возраст конкурентов",
      value: fmtMonths(summary.avgCompetitorDomainAgeMonths, en),
      insight: ageInsight(summary.avgCompetitorDomainAgeMonths, en),
    },
    ...(hasGsc
      ? [
          {
            icon: MousePointerClick,
            label: en ? "GSC clicks" : "Кликов из GSC",
            value: summary.gscTotalClicks.toLocaleString(),
            insight: clicksInsight(summary.gscTotalClicks, en),
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

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Swords } from "lucide-react";
import type { CompetitorComparison, ComparisonReason } from "@/lib/claude";

const IMPACT_CONFIG = {
  high:   { label: "Высокий",  className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  medium: { label: "Средний",  className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  low:    { label: "Низкий",   className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
} as const;

const CATEGORY_LABEL: Record<ComparisonReason["category"], string> = {
  content:   "Контент",
  structure: "Структура",
  keywords:  "Ключи",
  technical: "Техника",
  eeat:      "Доверие",
};

function ComparisonCard({ comparison }: { comparison: CompetitorComparison }) {
  const [open, setOpen] = useState(true);
  const domain = (() => { try { return new URL(comparison.competitorUrl).hostname; } catch { return comparison.competitorUrl; } })();

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
            #{comparison.competitorPosition}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{domain}</p>
            <p className="text-xs text-muted-foreground truncate">{comparison.summary}</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground ml-2" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground ml-2" />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {comparison.reasons.map((reason, i) => {
            const impact = IMPACT_CONFIG[reason.impact] ?? IMPACT_CONFIG.low;
            return (
              <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                    {CATEGORY_LABEL[reason.category]}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${impact.className}`}>
                    {impact.label}
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug">{reason.finding}</p>
                <p className="text-sm text-muted-foreground leading-snug">→ {reason.recommendation}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Props {
  comparisons: CompetitorComparison[];
  isPro: boolean;
}

export function CompetitorComparisonSection({ comparisons, isPro }: Props) {
  if (comparisons.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Swords className="h-4 w-4" /> Почему конкурент выше тебя
        </CardTitle>
        {!isPro && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Показан анализ 1 конкурента. Pro — до 3 конкурентов.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {comparisons.map((c, i) => (
          <ComparisonCard key={i} comparison={c} />
        ))}
      </CardContent>
    </Card>
  );
}

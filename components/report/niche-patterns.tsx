"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, BarChart2 } from "lucide-react";
import type { PatternInsight } from "@/lib/nichePatterns";

const TYPE_LABEL: Record<string, string> = {
  conversion: "Конверсия",
  trust: "Доверие",
  content: "Контент",
  technical: "Техническое",
  navigation: "Навигация",
};

const TYPE_COLOR: Record<string, string> = {
  conversion: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50",
  trust: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50",
  content: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/50",
  technical: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700",
  navigation: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700",
};

function FrequencyBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8">{pct}%</span>
    </div>
  );
}

export function NichePatternsSection({ patterns }: { patterns: PatternInsight[] }) {
  if (!patterns?.length) return null;

  const missing = patterns.filter((p) => !p.present);
  const present = patterns.filter((p) => p.present);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart2 className="h-4 w-4" /> Паттерны ниши
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Что есть у конкурентов в топе — и чего не хватает у вас
        </p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Отсутствующие — главное */}
        {missing.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Не хватает ({missing.length})
            </p>
            <div className="space-y-2">
              {missing.map((p, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{p.label}</p>
                        <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded border ${TYPE_COLOR[p.patternType] ?? TYPE_COLOR.technical}`}>
                          {TYPE_LABEL[p.patternType] ?? p.patternType}
                        </span>
                      </div>
                      <FrequencyBar value={p.frequency} />
                    </div>
                    {p.rationale && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.rationale}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Присутствующие — для справки */}
        {present.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Уже есть ({present.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {present.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {p.label}
                  <span className="opacity-60">{Math.round(p.frequency * 100)}%</span>
                </span>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

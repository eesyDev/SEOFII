"use client";

import { useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { describeChange } from "@/lib/pageMonitor";

interface DetectedChange {
  id: string;
  changeType: string;
  field: string;
  valueBefore: string;
  valueAfter: string;
  detectedAt: string;
}

interface RankingOutcome {
  keyword: string;
  positionBefore: number;
  positionAfter: number;
  delta: number;
  daysAfterChange: number;
}

interface MonitoringData {
  changes: DetectedChange[];
  outcomes: RankingOutcome[];
  isActive: boolean;
}

export function MonitoringSection({ data }: { data: MonitoringData }) {
  const en = useLocale() === "en";
  const improved = data.outcomes.filter((o) => o.delta < -0.5);
  const declined = data.outcomes.filter((o) => o.delta > 0.5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-500" />
          {en ? "Page monitoring" : "Мониторинг страницы"}
          {data.isActive && (
            <span className="ml-auto text-xs font-normal text-green-600 dark:text-green-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              {en ? "Active" : "Активен"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Результаты из GSC */}
        {data.outcomes.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
              {en ? "Impact of changes (GSC)" : "Результат изменений (из GSC)"}
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{improved.length}</p>
                <p className="text-xs text-muted-foreground">{en ? "queries improved" : "запросов улучшились"}</p>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-red-500">{declined.length}</p>
                <p className="text-xs text-muted-foreground">{en ? "queries dropped" : "запросов упали"}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {[...improved.slice(0, 3), ...declined.slice(0, 2)].map((o, i) => (
                <OutcomeRow key={i} outcome={o} />
              ))}
            </div>
          </div>
        )}

        {/* История изменений на странице */}
        {data.changes.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
              {en ? "What changed on the page" : "Что изменилось на странице"}
            </p>
            <div className="space-y-2">
              {data.changes.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p>{describeChange(c)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.detectedAt).toLocaleDateString("ru-RU", {
                        day: "numeric", month: "short",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.changes.length === 0 && data.outcomes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {en ? "The page is checked weekly. Changes will appear here." : "Страница проверяется каждую неделю. Когда что-то изменится — покажем здесь."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function OutcomeRow({ outcome }: { outcome: RankingOutcome }) {
  const improved = outcome.delta < -0.5;
  const declined = outcome.delta > 0.5;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
      <span className="truncate text-muted-foreground max-w-[180px]" title={outcome.keyword}>
        {outcome.keyword}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground tabular-nums">
          {outcome.positionBefore.toFixed(1)} → {outcome.positionAfter.toFixed(1)}
        </span>
        <Badge
          variant="outline"
          className={
            improved
              ? "border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/5"
              : declined
              ? "border-red-500/30 text-red-500 bg-red-500/5"
              : "border-muted"
          }
        >
          {improved ? (
            <TrendingUp className="h-3 w-3 mr-1" />
          ) : declined ? (
            <TrendingDown className="h-3 w-3 mr-1" />
          ) : (
            <Minus className="h-3 w-3 mr-1" />
          )}
          {Math.abs(outcome.delta).toFixed(1)}
        </Badge>
      </div>
    </div>
  );
}

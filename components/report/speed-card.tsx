import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge } from "lucide-react";
import type { PageSpeedData } from "@/lib/pagespeed";

const SCORE_CONFIG = (score: number) =>
  score >= 90
    ? { label: "Хорошо",           color: "text-green-600 dark:text-green-400",  ring: "bg-green-500", bar: "bg-green-500" }
    : score >= 50
    ? { label: "Требует улучшений", color: "text-yellow-600 dark:text-yellow-400", ring: "bg-yellow-500", bar: "bg-yellow-500" }
    : { label: "Плохо",            color: "text-red-600 dark:text-red-400",       ring: "bg-red-500",    bar: "bg-red-500"   };

function ScoreRing({ score }: { score: number }) {
  const cfg = SCORE_CONFIG(score);
  const pct = score;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={cfg.bar.replace("bg-", "stroke-")}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold leading-none ${cfg.color}`}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

interface MetricProps {
  label: string;
  value: string | null;
  good: string;   // порог "хорошо"
  poor: string;   // порог "плохо"
  unit?: string;
}

function Metric({ label, value, good, poor }: MetricProps) {
  if (!value) return (
    <div className="rounded-lg border p-3 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-muted-foreground">—</p>
    </div>
  );

  // Парсим число для цветового статуса
  const num = parseFloat(value.replace(/[^\d.]/g, ""));
  const goodNum = parseFloat(good);
  const poorNum = parseFloat(poor);
  const color =
    num <= goodNum ? "text-green-600 dark:text-green-400" :
    num <= poorNum ? "text-yellow-600 dark:text-yellow-400" :
                    "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-lg border p-3 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">хорошо ≤ {good}</p>
    </div>
  );
}

interface CompetitorSpeedRow {
  domain: string;
  data: PageSpeedData;
}

interface Props {
  targetUrl: string;
  targetSpeed: PageSpeedData;
  competitorSpeeds: CompetitorSpeedRow[];
}

export function SpeedCard({ targetUrl, targetSpeed, competitorSpeeds }: Props) {
  const hasData = targetSpeed.score != null && !targetSpeed.fetchError;
  const domain = (() => { try { return new URL(targetUrl).hostname; } catch { return targetUrl; } })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4" /> Скорость страницы (mobile)
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Google Lighthouse — чем выше балл, тем лучше для SEO и конверсии
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasData ? (
          <p className="text-sm text-muted-foreground">
            {targetSpeed.fetchError
              ? `Не удалось получить данные: ${targetSpeed.fetchError}`
              : "Данные скорости недоступны"}
          </p>
        ) : (
          <>
            {/* Основной скор + метрики */}
            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <ScoreRing score={targetSpeed.score!} />
                <p className={`text-xs font-medium ${SCORE_CONFIG(targetSpeed.score!).color}`}>
                  {SCORE_CONFIG(targetSpeed.score!).label}
                </p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[80px] text-center">{domain}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 flex-1">
                <Metric label="LCP" value={targetSpeed.lcp} good="2.5 s" poor="4 s" />
                <Metric label="FCP" value={targetSpeed.fcp} good="1.8 s" poor="3 s" />
                <Metric label="TBT" value={targetSpeed.tbt} good="200 ms" poor="600 ms" />
                <Metric label="CLS" value={targetSpeed.cls} good="0.1" poor="0.25" />
              </div>
            </div>

            {/* Сравнение с конкурентами */}
            {competitorSpeeds.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Сравнение с конкурентами
                </p>
                <div className="space-y-2">
                  {/* Ваша строка */}
                  <SpeedBarRow
                    label={`${domain} (вы)`}
                    score={targetSpeed.score!}
                    isYou
                  />
                  {competitorSpeeds.map((c, i) => (
                    c.data.score != null && (
                      <SpeedBarRow
                        key={i}
                        label={c.domain}
                        score={c.data.score}
                      />
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Что это значит */}
            {targetSpeed.score! < 50 && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/20 px-4 py-3 text-sm">
                <p className="font-medium text-red-700 dark:text-red-400 mb-1">Низкая скорость влияет на позиции</p>
                <p className="text-red-600 dark:text-red-500 text-xs">
                  Google использует Core Web Vitals как фактор ранжирования. Страницы с LCP &gt; 4s теряют позиции.
                  Обратитесь к разработчику — оптимизация обычно занимает 1–2 дня.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SpeedBarRow({ label, score, isYou }: { label: string; score: number; isYou?: boolean }) {
  const cfg = SCORE_CONFIG(score);
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className={`w-40 truncate shrink-0 ${isYou ? "font-semibold" : "text-muted-foreground"}`}>
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${cfg.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`w-8 text-right tabular-nums font-medium ${cfg.color}`}>{score}</span>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, SplitSquareHorizontal } from "lucide-react";
import type { SemanticAnalysis } from "@/lib/semantic";

function scoreColor(score: number): string {
  if (score >= 75) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function barColor(score: number): string {
  if (score >= 75) return "bg-green-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function ScoreBar({ label, score, bold }: { label: string; score: number; bold?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
        <span className={`tabular-nums font-semibold ${scoreColor(score)}`}>{score}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${barColor(score)}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Релевантность страницы запросу — таб «Что делать»
// ─────────────────────────────────────────

export function SemanticRelevanceCard({
  relevance,
  targetKeyword,
}: {
  relevance: NonNullable<SemanticAnalysis["relevance"]>;
  targetKeyword: string;
}) {
  const gap = relevance.top3Avg - relevance.pageScore;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4" /> Семантическая релевантность
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Насколько содержание страницы соответствует запросу «{targetKeyword}» — по смыслу, а не по вхождениям слов.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScoreBar label="Ваша страница" score={relevance.pageScore} bold />
        <ScoreBar label="Топ-3 конкурентов (среднее)" score={relevance.top3Avg} />

        {gap > 3 && (
          <p className="text-sm text-muted-foreground">
            Разрыв {gap} п.п. — конкуренты раскрывают тему запроса полнее. Смотрите «Семантические
            пробелы» во вкладке «Ключевые слова»: там перечислены темы, которых не хватает.
          </p>
        )}
        {gap <= 3 && relevance.pageScore >= 75 && (
          <p className="text-sm text-muted-foreground">
            Страница семантически на уровне топа — фокус на техничку, доверие и ссылки.
          </p>
        )}

        {relevance.perCompetitor.length > 0 && (
          <div className="pt-1 space-y-1.5">
            {relevance.perCompetitor.map((c) => (
              <div key={c.domain + c.position} className="flex items-center gap-2 text-xs">
                <span className="w-8 text-muted-foreground tabular-nums">#{c.position}</span>
                <span className="flex-1 truncate">{c.domain}</span>
                <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${barColor(c.score)}`} style={{ width: `${c.score}%` }} />
                </div>
                <span className={`w-9 text-right tabular-nums font-medium ${scoreColor(c.score)}`}>{c.score}%</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// Кластеры спроса + семантические пробелы — таб «Ключевые слова»
// ─────────────────────────────────────────

export function SemanticClustersSection({ analysis }: { analysis: SemanticAnalysis }) {
  const { queryClusters, semanticGaps } = analysis;
  if (queryClusters.length === 0 && semanticGaps.length === 0) return null;

  return (
    <>
      {queryClusters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4" /> Спрос по темам (из Search Console)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Запросы сгруппированы по смыслу. Много показов + низкая релевантность страницы = тема,
              под которую нужен контент.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Тема</th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Запросов</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Показы</th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Ср. позиция</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Раскрыта на</th>
                  </tr>
                </thead>
                <tbody>
                  {queryClusters.map((cl, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5 max-w-[260px]">
                        <span className="block font-medium truncate" title={cl.queries.join(", ")}>
                          {cl.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{cl.queries.length}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {cl.totalImpressions.toLocaleString("ru-RU")}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{cl.avgPosition}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${scoreColor(cl.pageRelevance)}`}>
                        {cl.pageRelevance}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {semanticGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <SplitSquareHorizontal className="h-4 w-4" /> Семантические пробелы
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Темы разделов конкурентов, у которых на вашей странице нет смыслового аналога — даже другими словами.
            </p>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {semanticGaps.map((gap, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-1.5 text-sm">
                <p className="font-medium leading-snug">«{gap.theme}»</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Есть у:</span>
                  {gap.competitors.map((d) => (
                    <span key={d} className="rounded-full bg-muted px-2 py-0.5 font-medium">{d}</span>
                  ))}
                </div>
                {gap.closestOwn && (
                  <p className="text-xs text-muted-foreground">
                    Ваш ближайший раздел: «{gap.closestOwn}» — похож лишь на {gap.similarity}%
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

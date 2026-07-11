import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { isUrlQuery, type GscRow } from "@/lib/gsc";

// Средний CTR по позициям в Google (агрегированные исследования)
function expectedCtr(position: number): number {
  if (position <= 1) return 0.28;
  if (position <= 2) return 0.15;
  if (position <= 3) return 0.11;
  if (position <= 5) return 0.07;
  if (position <= 10) return 0.03;
  return 0.01;
}

// Сколько кликов в месяц принесёт выход в топ-3 при текущих показах
function potentialClicks(row: GscRow): number {
  const gain = expectedCtr(3) - row.ctr;
  return gain > 0 ? Math.round(row.impressions * gain) : 0;
}

export function QuickWinsSection({ quickWins }: { quickWins: GscRow[] }) {
  // Страховка для старых отчётов: URL из вкладки «Страницы» — не запросы
  const rows = quickWins
    .filter((r) => !isUrlQuery(r.query))
    .slice(0, 10);

  if (rows.length === 0) return null;

  const totalPotential = rows.reduce((s, r) => s + potentialClicks(r), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" /> Быстрые победы
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Запросы, по которым Google уже показывает вас на позициях 5–20. Небольшая доработка
          страницы под них — самый короткий путь к трафику
          {totalPotential > 0 && <> (~{totalPotential.toLocaleString("ru-RU")} кликов/мес при выходе в топ-3)</>}.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Запрос</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Позиция</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Показы</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Клики</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Потенциал</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pot = potentialClicks(r);
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium max-w-[280px]">
                      <span className="block truncate" title={r.query}>{r.query}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.position <= 10
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        {r.position.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {r.impressions.toLocaleString("ru-RU")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {r.clicks.toLocaleString("ru-RU")}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {pot > 0 ? `+${pot.toLocaleString("ru-RU")}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

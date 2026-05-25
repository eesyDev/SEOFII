import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutGrid } from "lucide-react";
import type { BlockRow } from "@/lib/claude";

const PRIORITY_CONFIG = {
  must:     { label: "Нужно добавить",  className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  consider: { label: "Стоит добавить",  className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  optional: { label: "Опционально",     className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
} as const;

function Cell({ value }: { value: boolean }) {
  return value
    ? <span className="text-green-500 text-base leading-none">✓</span>
    : <span className="text-muted-foreground/40 text-base leading-none">✗</span>;
}

interface Props {
  blockMatrix: BlockRow[];
  competitorDomains: string[]; // для заголовков колонок
}

export function BlockMatrixSection({ blockMatrix, competitorDomains }: Props) {
  if (blockMatrix.length === 0) return null;

  const compCount = competitorDomains.length || (blockMatrix[0]?.competitors.length ?? 0);
  const colLabels = competitorDomains.length > 0
    ? competitorDomains.map((d) => {
        try { return new URL(d.startsWith("http") ? d : `https://${d}`).hostname.replace("www.", ""); }
        catch { return d; }
      })
    : Array.from({ length: compCount }, (_, i) => `#${i + 1}`);

  // Разбиваем на группы
  const missing = blockMatrix.filter((r) => !r.yours && r.priority !== "optional");
  const optional = blockMatrix.filter((r) => !r.yours && r.priority === "optional");
  const present = blockMatrix.filter((r) => r.yours);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" /> Какие блоки добавить на страницу
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Сравнение с конкурентами — зелёный ✓ означает что блок есть.
          Анализ статический (без JS), может не видеть динамические компоненты.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm border-collapse min-w-[420px]">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground w-[38%]">Блок</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground w-[10%]">Вы</th>
                {colLabels.map((label, i) => (
                  <th key={i} className="text-center py-2 px-2 font-medium text-muted-foreground w-[10%] truncate max-w-[80px]" title={label}>
                    {label.length > 10 ? label.slice(0, 9) + "…" : label}
                  </th>
                ))}
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Что сделать</th>
              </tr>
            </thead>
            <tbody>
              {missing.length > 0 && (
                <>
                  <tr>
                    <td colSpan={3 + compCount} className="pt-3 pb-1 px-2">
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
                        Отсутствует — добавить
                      </span>
                    </td>
                  </tr>
                  {missing.map((row, i) => (
                    <BlockRow key={i} row={row} compCount={compCount} />
                  ))}
                </>
              )}

              {optional.length > 0 && (
                <>
                  <tr>
                    <td colSpan={3 + compCount} className="pt-4 pb-1 px-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Опционально
                      </span>
                    </td>
                  </tr>
                  {optional.map((row, i) => (
                    <BlockRow key={i} row={row} compCount={compCount} />
                  ))}
                </>
              )}

              {present.length > 0 && (
                <>
                  <tr>
                    <td colSpan={3 + compCount} className="pt-4 pb-1 px-2">
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">
                        Уже есть
                      </span>
                    </td>
                  </tr>
                  {present.map((row, i) => (
                    <BlockRow key={i} row={row} compCount={compCount} />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function BlockRow({ row, compCount }: { row: BlockRow; compCount: number }) {
  const p = PRIORITY_CONFIG[row.priority];
  const isMissing = !row.yours;

  return (
    <tr className={`border-b last:border-0 ${isMissing && row.priority !== "optional" ? "bg-red-50/40 dark:bg-red-900/10" : ""}`}>
      <td className="py-2.5 px-2 align-top">
        <div className="flex items-start gap-2">
          <span className="font-medium leading-snug">{row.block}</span>
          {isMissing && (
            <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${p.className}`}>
              {p.label}
            </span>
          )}
        </div>
      </td>
      <td className="py-2.5 px-2 text-center align-top">
        <Cell value={row.yours} />
      </td>
      {Array.from({ length: compCount }).map((_, i) => (
        <td key={i} className="py-2.5 px-2 text-center align-top">
          <Cell value={row.competitors[i] ?? false} />
        </td>
      ))}
      <td className="py-2.5 px-2 align-top">
        {isMissing ? (
          <p className="text-xs text-muted-foreground leading-snug">{row.tip}</p>
        ) : (
          <p className="text-xs text-green-600 dark:text-green-400">Хорошо</p>
        )}
      </td>
    </tr>
  );
}

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, AlertCircle, Upload, CheckCircle2, X, Info } from "lucide-react";
import { parseGscCsvDetailed, type GscRow } from "@/lib/gsc";
import { LOCATIONS } from "@/lib/dataforseo";

export default function NewReportPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gscRows, setGscRows] = useState<GscRow[] | null>(null);
  const [gscFileNames, setGscFileNames] = useState<string[]>([]);
  const [gscError, setGscError] = useState("");
  const [showNoGscWarning, setShowNoGscWarning] = useState(false);
  const [locationCode, setLocationCode] = useState(2840);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function mergeGscRows(allRows: GscRow[][]): GscRow[] {
    const map = new Map<string, GscRow>();
    for (const rows of allRows) {
      for (const row of rows) {
        const existing = map.get(row.query);
        if (existing) {
          // Мёржим: суммируем клики/показы, усредняем позицию и CTR
          const totalImpressions = existing.impressions + row.impressions;
          map.set(row.query, {
            query: row.query,
            clicks: existing.clicks + row.clicks,
            impressions: totalImpressions,
            ctr: totalImpressions > 0 ? (existing.clicks + row.clicks) / totalImpressions : 0,
            position: (existing.position + row.position) / 2,
          });
        } else {
          map.set(row.query, { ...row });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.impressions - a.impressions);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setGscError("");

    const promises = files.map(
      (file) =>
        new Promise<{ name: string; rows: GscRow[]; error?: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const { rows, debugInfo } = parseGscCsvDetailed(text);
            resolve({ name: file.name, rows, error: rows.length === 0 ? debugInfo : undefined });
          };
          reader.readAsText(file, "utf-8");
        })
    );

    Promise.all(promises).then((results) => {
      const errors = results.filter((r) => r.error);
      const valid = results.filter((r) => r.rows.length > 0);

      if (valid.length === 0) {
        setGscError(errors[0]?.error ?? "Не удалось прочитать файл.");
        return;
      }
      if (errors.length > 0) {
        setGscError(`Не удалось прочитать: ${errors.map((e) => e.name).join(", ")}`);
      }
      const merged = mergeGscRows(valid.map((r) => r.rows));
      setGscRows(merged);
      setGscFileNames(valid.map((r) => r.name));
    });
  }

  function clearGsc() {
    setGscRows(null);
    setGscFileNames([]);
    setGscError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submitReport() {
    setLoading(true);
    setShowNoGscWarning(false);
    setError("");

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, gscData: gscRows ?? null, locationCode }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.code === "LIMIT_REACHED") {
        setError("Лимит отчётов исчерпан. Перейди на платный план.");
      } else {
        setError(typeof data.error === "string" ? data.error : "Что-то пошло не так");
      }
      setLoading(false);
      return;
    }

    router.push(`/reports/${data.reportId}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gscRows) {
      setShowNoGscWarning(true);
      return;
    }
    submitReport();
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Новый отчёт</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Введи URL страницы — мы проанализируем конкурентов из выдачи и сгенерируем ТЗ
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">URL страницы</CardTitle>
          <CardDescription>
            Например: https://example.com/blog/seo-tips
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/page"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label htmlFor="location">Регион поиска</Label>
              <select
                id="location"
                value={locationCode}
                onChange={(e) => setLocationCode(Number(e.target.value))}
                disabled={loading}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {Object.entries(LOCATIONS).map(([key, { code, label }]) => (
                  <option key={key} value={code}>{label}</option>
                ))}
              </select>
            </div>

            {/* GSC Upload */}
            <div className="space-y-1.5">
              <Label>
                Google Search Console{" "}
                <span className="text-muted-foreground font-normal">(опционально)</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Загрузи CSV из GSC → Эффективность → Запросы → Экспорт. Улучшает анализ: gap, quick wins, бриф.
              </p>

              {!gscRows ? (
                <div
                  className="relative flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-5 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span>Нажми чтобы выбрать CSV файл(ы)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    multiple
                    className="sr-only"
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span className="font-medium">{gscRows.length} запросов</span>
                      <span className="text-muted-foreground">из {gscFileNames.length} файл{gscFileNames.length > 1 ? "ов" : "а"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={clearGsc}
                      className="text-muted-foreground hover:text-foreground transition-colors ml-2"
                      aria-label="Удалить файлы"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {gscFileNames.length > 1 && (
                    <div className="flex flex-wrap gap-1">
                      {gscFileNames.map((name, i) => (
                        <span key={i} className="text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground truncate max-w-[160px]">
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {gscError && (
                <p className="text-xs text-destructive flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {gscError}
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {showNoGscWarning && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800/50 dark:bg-yellow-900/20 px-4 py-3 space-y-2">
                <div className="flex items-start gap-2 text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Ты не загрузил CSV из Google Search Console</span>
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 pl-6">
                  Без него отчёт не покажет quick wins, реальные позиции и данные по кликам.
                  Результат будет основан только на анализе конкурентов.
                </p>
                <div className="flex gap-2 pl-6 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 border-yellow-300 dark:border-yellow-700"
                    onClick={() => { setShowNoGscWarning(false); fileInputRef.current?.click(); }}
                  >
                    Загрузить CSV
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
                    onClick={submitReport}
                  >
                    Продолжить без CSV
                  </Button>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Создаём отчёт...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Сгенерировать ТЗ
                </>
              )}
            </Button>
          </form>

          {loading && (
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Получаем конкурентов из выдачи (DataForSEO)...
              </p>
              <p className="flex items-center gap-2 opacity-60">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                Анализируем ключевые слова...
              </p>
              <p className="flex items-center gap-2 opacity-40">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                Генерируем ТЗ через Claude AI...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

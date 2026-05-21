"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, AlertCircle, Upload, CheckCircle2, X } from "lucide-react";
import { parseGscCsv, type GscRow } from "@/lib/gsc";

export default function NewReportPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gscRows, setGscRows] = useState<GscRow[] | null>(null);
  const [gscFileName, setGscFileName] = useState("");
  const [gscError, setGscError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setGscError("");
    setGscRows(null);
    setGscFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseGscCsv(text);
      if (rows.length === 0) {
        setGscError("Не удалось прочитать файл. Убедись, что это экспорт из GSC (Запросы → Экспорт → CSV).");
        setGscFileName("");
      } else {
        setGscRows(rows);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function clearGsc() {
    setGscRows(null);
    setGscFileName("");
    setGscError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, gscData: gscRows ?? null }),
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

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Новый отчёт</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Введи URL страницы — мы проанализируем топ-10 конкурентов и сгенерируем ТЗ
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
                  <span>Нажми чтобы выбрать CSV файл</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="font-medium">{gscFileName}</span>
                    <span className="text-muted-foreground">— {gscRows.length} запросов</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearGsc}
                    className="text-muted-foreground hover:text-foreground transition-colors ml-2"
                    aria-label="Удалить файл"
                  >
                    <X className="h-4 w-4" />
                  </button>
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
                Получаем топ-10 конкурентов из DataForSEO...
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

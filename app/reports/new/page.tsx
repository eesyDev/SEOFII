"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, AlertCircle } from "lucide-react";

export default function NewReportPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
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
          <form onSubmit={handleSubmit} className="space-y-4">
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

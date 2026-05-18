import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Loader2,
  BarChart2, Users, FileText, Lightbulb,
} from "lucide-react";
import Link from "next/link";
import type { SEOBrief } from "@/lib/claude";

const STATUS_CONFIG = {
  PENDING:    { label: "В очереди",       icon: Clock,         variant: "outline"     },
  PROCESSING: { label: "Обрабатывается",  icon: Loader2,       variant: "secondary"   },
  DONE:       { label: "Готов",           icon: CheckCircle2,  variant: "default"     },
  FAILED:     { label: "Ошибка",          icon: XCircle,       variant: "destructive" },
} as const;

export default async function ReportPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const report = await prisma.report.findUnique({
    where: { id: params.id, userId: session.user.id },
    include: {
      competitors: { orderBy: { position: "asc" } },
      keywords:    { orderBy: { volume: "desc" }, take: 20 },
      project:     { select: { name: true } },
    },
  });

  if (!report) notFound();

  const config = STATUS_CONFIG[report.status];
  const StatusIcon = config.icon;
  const brief = report.result as SEOBrief | null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Хедер */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="-ml-2 shrink-0">
          <Link href="/reports"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{report.url}</h1>
            <Badge variant={config.variant as any} className="shrink-0">
              <StatusIcon className={`h-3 w-3 mr-1 ${report.status === "PROCESSING" ? "animate-spin" : ""}`} />
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {report.project?.name && `${report.project.name} · `}
            {new Date(report.createdAt).toLocaleDateString("ru-RU", {
              day: "numeric", month: "long", year: "numeric",
            })}
            {report.costUsd && ` · $${Number(report.costUsd).toFixed(4)}`}
          </p>
        </div>
      </div>

      {/* Ошибка */}
      {report.status === "FAILED" && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive font-medium">Ошибка генерации</p>
            <p className="text-sm text-muted-foreground mt-1">
              {report.errorMessage ?? "Неизвестная ошибка"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* В процессе */}
      {(report.status === "PENDING" || report.status === "PROCESSING") && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="font-medium">Генерируем ТЗ...</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Анализируем конкурентов и ключевые слова. Обычно занимает 1–2 минуты.
            </p>
            <p className="text-xs text-muted-foreground">Обнови страницу чтобы проверить готовность</p>
          </CardContent>
        </Card>
      )}

      {/* Готовый отчёт */}
      {report.status === "DONE" && brief && (
        <>
          {/* Мета-теги */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Мета-данные
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Title</p>
                <p className="font-medium">{brief.recommendedTitle}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-1">Meta Description</p>
                <p>{brief.recommendedMetaDescription}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-1">H1</p>
                <p className="font-medium">{brief.recommendedH1}</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">Основной ключевой запрос</p>
                <Badge variant="secondary">{brief.targetKeyword}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">Рекомендуемый объём</p>
                <span className="font-medium">{brief.wordCountRecommendation.toLocaleString()} слов</span>
              </div>
            </CardContent>
          </Card>

          {/* Структура контента */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Структура статьи
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {brief.contentStructure.map((section, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-muted-foreground text-sm w-5 shrink-0 pt-0.5">{i + 1}.</span>
                  <div>
                    <p className="text-sm font-medium">{section.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{section.content}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Ключевые слова + конкуренты */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" /> Ключевые слова
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.keywords.length > 0 ? (
                  <div className="space-y-2">
                    {report.keywords.map((kw) => (
                      <div key={kw.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{kw.keyword}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {kw.volume.toLocaleString()} / мес
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> Конкуренты
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.competitors.length > 0 ? (
                  <div className="space-y-2">
                    {report.competitors.map((c) => (
                      <div key={c.id} className="flex items-start gap-2 text-sm">
                        <span className="text-muted-foreground w-4 shrink-0 tabular-nums">{c.position}.</span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.title}</p>
                          <p className="text-muted-foreground truncate">{c.domain}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Рекомендации */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4" /> Рекомендации
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Анализ конкурентов</p>
                <p>{brief.competitorInsights}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2">Дополнительно</p>
                <ul className="space-y-1.5">
                  {brief.additionalRecommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

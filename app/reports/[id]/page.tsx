import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Loader2,
  BarChart2, Users, FileText, Lightbulb, ShieldCheck, Zap, Lock, TrendingUp, Link2,
} from "lucide-react";
import Link from "next/link";
import type { SEOBrief, EEATScore, ContentGap, LinkBuildingStrategy } from "@/lib/claude";
import { ReportPoller } from "@/components/report-poller";

const STATUS_CONFIG = {
  PENDING:    { label: "В очереди",       icon: Clock,         variant: "outline"     },
  PROCESSING: { label: "Обрабатывается",  icon: Loader2,       variant: "secondary"   },
  DONE:       { label: "Готов",           icon: CheckCircle2,  variant: "default"     },
  FAILED:     { label: "Ошибка",          icon: XCircle,       variant: "destructive" },
} as const;

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const { id } = await params;

  const [report, user] = await Promise.all([
    prisma.report.findUnique({
      where: { id, userId },
      include: {
        competitors: { orderBy: { position: "asc" } },
        keywords:    { orderBy: { volume: "desc" }, take: 20 },
        project:     { select: { name: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    }),
  ]);

  if (!report) notFound();

  const config = STATUS_CONFIG[report.status];
  const StatusIcon = config.icon;
  const brief = report.result as SEOBrief | null;
  const isFree = !user || user.plan === "FREE";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ReportPoller reportId={id} initialStatus={report.status} />
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
            <p className="text-xs text-muted-foreground">Страница обновится автоматически</p>
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
                    {report.competitors.map((c) => {
                      const di = (brief.domainInfo as Record<string, { domainAge?: string; referringDomains?: number }> | undefined)?.[c.domain];
                      return (
                        <div key={c.id} className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground w-4 shrink-0 tabular-nums">{c.position}.</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{c.title}</p>
                            <p className="text-muted-foreground truncate">{c.domain}</p>
                            {di && (
                              <p className="text-xs text-muted-foreground/70 mt-0.5">
                                {di.domainAge && <span>{di.domainAge}</span>}
                                {di.domainAge && di.referringDomains !== undefined && <span className="mx-1">·</span>}
                                {di.referringDomains !== undefined && <span>{di.referringDomains.toLocaleString()} RD</span>}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
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

          {/* Контентные пробелы */}
          {brief.contentGaps?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Что создать дальше
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {brief.contentGaps.map((gap, i) => (
                  <ContentGapRow key={i} gap={gap} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Линкбилдинг */}
          {brief.linkBuildingStrategy && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4" /> Стратегия линкбилдинга
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p>{brief.linkBuildingStrategy.summary}</p>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Целевой DR:</span>
                  <Badge variant="secondary">{brief.linkBuildingStrategy.targetDR}</Badge>
                </div>
                <Separator />
                <div className="space-y-3">
                  {brief.linkBuildingStrategy.recommendations.map((rec, i) => (
                    <LinkBuildingRow key={i} rec={rec} />
                  ))}
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground mb-1">Стратегия анкоров</p>
                  <p>{brief.linkBuildingStrategy.anchorTextStrategy}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* E-E-A-T анализ */}
          {/* Баннер апгрейда — только для Free */}
          {isFree && (
            <div className="relative rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 overflow-hidden">
              {/* Декоративный фон */}
              <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-primary/10" />
              <div className="absolute -right-2 -bottom-4 h-20 w-20 rounded-full bg-primary/5" />

              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <p className="font-semibold text-base">Получить полный отчёт</p>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  Это базовый отчёт. Pro-версия даёт в 3× больше данных для копирайтера:
                </p>

                <ul className="space-y-2 mb-5">
                  {[
                    "Разбор каждого конкурента отдельно — структура, объём, сильные стороны",
                    "LSI-кластеры и семантическое ядро по теме",
                    "Рекомендации по schema.org разметке для сниппетов",
                    "Анализ контентных пробелов — что есть у конкурентов, чего нет у вас",
                    "Приоритизированный план: с чего начать, что принесёт трафик быстрее",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Lock className="h-3.5 w-3.5 text-primary/60 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild size="sm" className="gap-2">
                  <Link href="/billing">
                    <Zap className="h-4 w-4" />
                    Перейти на Pro
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {brief.eeatAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> E-E-A-T анализ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 text-sm">
                {/* Общий балл */}
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground">Общий балл конкурентов</p>
                  <EEATBadge score={brief.eeatAnalysis.overallScore} />
                </div>

                <Separator />

                {/* 4 компонента */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      { key: "experience",       label: "Experience",       data: brief.eeatAnalysis.experience },
                      { key: "expertise",        label: "Expertise",        data: brief.eeatAnalysis.expertise },
                      { key: "authoritativeness",label: "Authoritativeness",data: brief.eeatAnalysis.authoritativeness },
                      { key: "trustworthiness",  label: "Trustworthiness",  data: brief.eeatAnalysis.trustworthiness },
                    ] as const
                  ).map(({ key, label, data }) => (
                    <EEATComponent key={key} label={label} data={data} />
                  ))}
                </div>

                <Separator />

                {/* Вывод */}
                <div>
                  <p className="text-muted-foreground mb-1">Вывод</p>
                  <p>{brief.eeatAnalysis.summary}</p>
                </div>

                <Separator />

                {/* Рекомендации для копирайтера */}
                <div>
                  <p className="text-muted-foreground mb-2">Как усилить E-E-A-T в тексте</p>
                  <ul className="space-y-1.5">
                    {brief.eeatAnalysis.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

const PRIORITY_CONFIG = {
  high:   { label: "Высокий",  className: "bg-green-100 text-green-800" },
  medium: { label: "Средний",  className: "bg-yellow-100 text-yellow-800" },
  low:    { label: "Низкий",   className: "bg-slate-100 text-slate-600" },
} as const;

const LINK_PRIORITY = {
  high:   { label: "Высокий",  className: "bg-green-100 text-green-800" },
  medium: { label: "Средний",  className: "bg-yellow-100 text-yellow-800" },
  low:    { label: "Низкий",   className: "bg-slate-100 text-slate-600" },
} as const;

function LinkBuildingRow({ rec }: { rec: LinkBuildingStrategy["recommendations"][number] }) {
  const p = LINK_PRIORITY[rec.priority] ?? LINK_PRIORITY.low;
  return (
    <div className="rounded-lg border p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-sm">{rec.type}</p>
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${p.className}`}>
          {p.label}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{rec.description}</p>
      {rec.examples.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Примеры: {rec.examples.join(", ")}
        </p>
      )}
    </div>
  );
}

function ContentGapRow({ gap }: { gap: ContentGap }) {
  const p = PRIORITY_CONFIG[gap.priority] ?? PRIORITY_CONFIG.low;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug">{gap.topic}</p>
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${p.className}`}>
          {p.label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground font-mono">{gap.suggestedSlug}</p>
      <p className="text-muted-foreground">{gap.rationale}</p>
      <p className="text-xs text-muted-foreground">Потенциал: {gap.trafficPotential}</p>
    </div>
  );
}

function EEATBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? "bg-green-100 text-green-800" :
    score >= 5 ? "bg-yellow-100 text-yellow-800" :
                 "bg-red-100 text-red-800";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {score}/10
    </span>
  );
}

function EEATComponent({ label, data }: { label: string; data: EEATScore }) {
  const pct = Math.round((data.score / 10) * 100);
  const barColor =
    data.score >= 8 ? "bg-green-500" :
    data.score >= 5 ? "bg-yellow-500" :
                      "bg-red-500";

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="font-medium text-xs">{label}</p>
        <span className="text-xs font-semibold tabular-nums">{data.score}/10</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {data.signals.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">Сигналы у конкурентов</p>
          <ul className="space-y-0.5">
            {data.signals.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px]">
                <span className="text-green-600 mt-0.5 shrink-0">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.gaps.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">Пробелы (ваш шанс)</p>
          <ul className="space-y-0.5">
            {data.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px]">
                <span className="text-yellow-600 mt-0.5 shrink-0">→</span>
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

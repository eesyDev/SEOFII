import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Loader2,
  FileText, Lightbulb, ShieldCheck, Zap, Lock, TrendingUp, Link2, Gauge,
} from "lucide-react";
import Link from "next/link";
import type { SEOBrief, EEATScore, ContentGap, LinkBuildingStrategy, CompetitorComparison, QuickFix, BlockRow } from "@/lib/claude";
import type { AnalyticsResult } from "@/lib/analytics";
import type { SerpResult, DomainInfo } from "@/lib/dataforseo";
import type { PageSpeedData } from "@/lib/pagespeed";
import type { GscRow } from "@/lib/gsc";
import { ReportPoller } from "@/components/report-poller";
import { SummaryCards } from "@/components/report/summary-cards";
import { VolumeChart, GscPositionsChart } from "@/components/report/report-charts";
import { KeywordTable } from "@/components/report/keyword-table";
import { CompetitorComparisonSection } from "@/components/report/competitor-comparison";
import { QuickFixesSection } from "@/components/report/quick-fixes";
import { BlockMatrixSection } from "@/components/report/block-matrix";
import { SpeedCard } from "@/components/report/speed-card";

// ─────────────────────────────────────────
// ТИПЫ
// ─────────────────────────────────────────

interface ReportResult {
  brief: SEOBrief;
  analytics?: AnalyticsResult;
  competitors?: SerpResult[];
  domainInfo?: Record<string, DomainInfo>;
  comparisons?: CompetitorComparison[];
  blockMatrix?: BlockRow[];
  quickFixes?: QuickFix[];
  pageSpeed?: Record<string, PageSpeedData>;
}

const STATUS_CONFIG = {
  PENDING:    { label: "В очереди",       icon: Clock,        variant: "outline"     },
  PROCESSING: { label: "Обрабатывается",  icon: Loader2,      variant: "secondary"   },
  DONE:       { label: "Готов",           icon: CheckCircle2, variant: "default"     },
  FAILED:     { label: "Ошибка",          icon: XCircle,      variant: "destructive" },
} as const;

// ─────────────────────────────────────────
// СТРАНИЦА
// ─────────────────────────────────────────

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
        project:     { select: { name: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, isAdmin: true },
    }),
  ]);

  if (!report) notFound();

  const config = STATUS_CONFIG[report.status];
  const StatusIcon = config.icon;
  const rawResult = report.result as any;
  const result: ReportResult | null = rawResult
    ? rawResult.brief && typeof rawResult.brief === "object"
      ? (rawResult as ReportResult)
      : { brief: rawResult as SEOBrief }
    : null;

  const brief       = result?.brief ?? null;
  const analytics   = result?.analytics ?? null;
  const comparisons = result?.comparisons ?? [];
  const blockMatrix = result?.blockMatrix ?? [];
  const quickFixes  = result?.quickFixes ?? [];
  const pageSpeed   = result?.pageSpeed ?? {};
  const gscRows     = (report.gscData as GscRow[] | null) ?? [];
  const hasGsc      = gscRows.length > 0;
  const isFree      = !user?.isAdmin && (!user || user.plan === "FREE");
  const domainInfo  = result?.domainInfo ?? {};

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <ReportPoller reportId={id} initialStatus={report.status} />

      {/* Хедер */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2 shrink-0">
          <Link href="/reports"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold truncate">{report.url}</h1>
            <Badge variant={config.variant as any} className="shrink-0">
              <StatusIcon className={`h-3 w-3 mr-1 ${report.status === "PROCESSING" ? "animate-spin" : ""}`} />
              {config.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {report.project?.name && `${report.project.name} · `}
            {new Date(report.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
            {report.costUsd && ` · $${Number(report.costUsd).toFixed(4)}`}
            {hasGsc && <span className="ml-1">· GSC ✓</span>}
          </p>
        </div>
      </div>

      {/* Ошибка */}
      {report.status === "FAILED" && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive font-medium">Ошибка генерации</p>
            <p className="text-sm text-muted-foreground mt-1">{report.errorMessage ?? "Неизвестная ошибка"}</p>
          </CardContent>
        </Card>
      )}

      {/* В процессе */}
      {(report.status === "PENDING" || report.status === "PROCESSING") && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="font-medium">Генерируем отчёт...</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Анализируем конкурентов, скорость страниц и ключевые слова. Обычно 1–2 минуты.
            </p>
            <p className="text-xs text-muted-foreground">Страница обновится автоматически</p>
          </CardContent>
        </Card>
      )}

      {/* Готовый отчёт */}
      {report.status === "DONE" && result && (
        <>
          {/* Summary cards — всегда сверху */}
          {analytics && <SummaryCards summary={analytics.summary} hasGsc={hasGsc} />}

          {/* Табы */}
          <Tabs defaultValue="actions">
            <TabsList className="w-full sm:w-auto flex overflow-x-auto">
              <TabsTrigger value="actions">Что делать</TabsTrigger>
              <TabsTrigger value="competitors">Конкуренты</TabsTrigger>
              <TabsTrigger value="brief">Бриф</TabsTrigger>
              <TabsTrigger value="keywords">Ключевые слова</TabsTrigger>
            </TabsList>

            {/* ── ТАБ 1: ЧТО ДЕЛАТЬ ── */}
            <TabsContent value="actions" className="space-y-4">
              {quickFixes.length > 0
                ? <QuickFixesSection quickFixes={quickFixes} />
                : <EmptyTab text="Создайте новый отчёт чтобы увидеть список задач" />
              }
              {blockMatrix.length > 0 && (
                <BlockMatrixSection
                  blockMatrix={blockMatrix}
                  competitorDomains={report.competitors.slice(0, comparisons.length).map((c) => c.domain)}
                />
              )}
            </TabsContent>

            {/* ── ТАБ 2: КОНКУРЕНТЫ ── */}
            <TabsContent value="competitors" className="space-y-4">
              {pageSpeed[report.url] && (
                <SpeedCard
                  targetUrl={report.url}
                  targetSpeed={pageSpeed[report.url]}
                  competitorSpeeds={report.competitors
                    .filter((c) => pageSpeed[c.url]?.score != null)
                    .slice(0, 3)
                    .map((c) => ({ domain: c.domain, data: pageSpeed[c.url] }))}
                />
              )}
              {comparisons.length > 0
                ? <CompetitorComparisonSection comparisons={comparisons} isPro={!isFree} />
                : <EmptyTab text="Создайте новый отчёт чтобы увидеть сравнение с конкурентами" />
              }

              {/* Таблица конкурентов с DR + скоростью */}
              {report.competitors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Топ-10 конкурентов</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-8">#</th>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Домен</th>
                            <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">RD</th>
                            <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Возраст</th>
                            <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">
                              <span className="flex items-center justify-center gap-1"><Gauge className="h-3 w-3" />Speed</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Строка для вашей страницы */}
                          {pageSpeed[report.url] && (
                            <tr className="border-b bg-primary/5">
                              <td className="px-4 py-2.5 text-muted-foreground">—</td>
                              <td className="px-4 py-2.5">
                                <p className="font-semibold text-primary truncate max-w-[200px]">
                                  {new URL(report.url).hostname} <span className="text-xs font-normal">(вы)</span>
                                </p>
                              </td>
                              <td className="px-3 py-2.5 text-center text-muted-foreground">—</td>
                              <td className="px-3 py-2.5 text-center text-muted-foreground">—</td>
                              <td className="px-3 py-2.5 text-center">
                                <SpeedBadge data={pageSpeed[report.url]} />
                              </td>
                            </tr>
                          )}
                          {report.competitors.map((c) => {
                            const di = domainInfo[c.domain] as DomainInfo | undefined;
                            const ps = pageSpeed[c.url];
                            return (
                              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{c.position}</td>
                                <td className="px-4 py-2.5">
                                  <a
                                    href={c.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium hover:underline truncate block max-w-[200px]"
                                    title={c.title}
                                  >
                                    {c.domain}
                                  </a>
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.title}</p>
                                </td>
                                <td className="px-3 py-2.5 text-center text-muted-foreground tabular-nums">
                                  {di?.referringDomains != null ? di.referringDomains.toLocaleString() : "—"}
                                </td>
                                <td className="px-3 py-2.5 text-center text-muted-foreground">
                                  {di?.domainAge ?? "—"}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {ps ? <SpeedBadge data={ps} /> : <span className="text-muted-foreground">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── ТАБ 3: БРИФ ── */}
            <TabsContent value="brief" className="space-y-4">
              {brief ? (
                <>
                  {/* Мета */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Мета-данные
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <MetaRow label="Title" value={brief.recommendedTitle} />
                      <Separator />
                      <MetaRow label="Meta Description" value={brief.recommendedMetaDescription} />
                      <Separator />
                      <MetaRow label="H1" value={brief.recommendedH1} bold />
                      <Separator />
                      <div className="flex items-center justify-between">
                        <p className="text-muted-foreground">Основной запрос</p>
                        <Badge variant="secondary">{brief.targetKeyword}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-muted-foreground">Рекомендуемый объём</p>
                        <span className="font-medium">{brief.wordCountRecommendation.toLocaleString()} слов</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Структура */}
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

                  {/* Рекомендации */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" /> Рекомендации
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p>{brief.competitorInsights}</p>
                      <Separator />
                      <ul className="space-y-1.5">
                        {brief.additionalRecommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
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
                        {brief.contentGaps.map((gap, i) => <ContentGapRow key={i} gap={gap} />)}
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

                  {/* Апгрейд баннер — Free */}
                  {isFree && (
                    <div className="relative rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5 overflow-hidden">
                      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-primary/10" />
                      <div className="relative flex items-start gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold mb-1">Получить полный отчёт</p>
                          <ul className="space-y-1 mb-4">
                            {[
                              "Разбор каждого конкурента — структура, объём, сильные стороны",
                              "LSI-кластеры и семантическое ядро",
                              "Рекомендации по schema.org разметке",
                              "Приоритизированный план с чего начать",
                            ].map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <Lock className="h-3.5 w-3.5 text-primary/60 mt-0.5 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                          <Button asChild size="sm" className="gap-2">
                            <Link href="/billing"><Zap className="h-4 w-4" /> Перейти на Pro</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* E-E-A-T */}
                  {brief.eeatAnalysis && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4" /> E-E-A-T анализ
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-muted-foreground">Общий балл конкурентов</p>
                          <EEATBadge score={brief.eeatAnalysis.overallScore} />
                        </div>
                        <Separator />
                        <div className="grid gap-3 sm:grid-cols-2">
                          {(["experience", "expertise", "authoritativeness", "trustworthiness"] as const).map((key) => (
                            <EEATComponent
                              key={key}
                              label={{ experience: "Experience", expertise: "Expertise", authoritativeness: "Authoritativeness", trustworthiness: "Trustworthiness" }[key]}
                              data={brief.eeatAnalysis[key]}
                            />
                          ))}
                        </div>
                        <Separator />
                        <p>{brief.eeatAnalysis.summary}</p>
                        <Separator />
                        <div>
                          <p className="text-muted-foreground mb-1.5">Как усилить E-E-A-T</p>
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
              ) : (
                <EmptyTab text="Бриф недоступен" />
              )}
            </TabsContent>

            {/* ── ТАБ 4: КЛЮЧЕВЫЕ СЛОВА ── */}
            <TabsContent value="keywords" className="space-y-4">
              {analytics ? (
                <>
                  <div className={`grid gap-4 ${hasGsc ? "lg:grid-cols-2" : ""}`}>
                    <VolumeChart keywords={analytics.allKeywords} />
                    {hasGsc && <GscPositionsChart gscRows={gscRows} />}
                  </div>
                  {analytics.allKeywords.length > 0 && (
                    <KeywordTable keywords={analytics.allKeywords} />
                  )}
                </>
              ) : (
                <EmptyTab text="Данные по ключевым словам недоступны" />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
// ─────────────────────────────────────────

function EmptyTab({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}

function MetaRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className={bold ? "font-medium" : ""}>{value}</p>
    </div>
  );
}

function SpeedBadge({ data }: { data: PageSpeedData }) {
  if (data.fetchError || data.score == null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const color =
    data.score >= 90 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
    data.score >= 50 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                       "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`} title={`LCP: ${data.lcp ?? "?"}, CLS: ${data.cls ?? "?"}`}>
      {data.score}
    </span>
  );
}

const PRIORITY_CONFIG = {
  high:   { label: "Высокий", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  medium: { label: "Средний", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  low:    { label: "Низкий",  className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
} as const;

function LinkBuildingRow({ rec }: { rec: LinkBuildingStrategy["recommendations"][number] }) {
  const p = PRIORITY_CONFIG[rec.priority] ?? PRIORITY_CONFIG.low;
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-sm">{rec.type}</p>
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${p.className}`}>{p.label}</span>
      </div>
      <p className="text-sm text-muted-foreground">{rec.description}</p>
      {rec.examples.length > 0 && (
        <p className="text-xs text-muted-foreground">Примеры: {rec.examples.join(", ")}</p>
      )}
    </div>
  );
}

function ContentGapRow({ gap }: { gap: ContentGap }) {
  const p = PRIORITY_CONFIG[gap.priority] ?? PRIORITY_CONFIG.low;
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug">{gap.topic}</p>
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${p.className}`}>{p.label}</span>
      </div>
      <p className="text-xs text-muted-foreground font-mono">{gap.suggestedSlug}</p>
      <p className="text-muted-foreground">{gap.rationale}</p>
      <p className="text-xs text-muted-foreground">Потенциал: {gap.trafficPotential}</p>
    </div>
  );
}

function EEATBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
    score >= 5 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                 "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {score}/10
    </span>
  );
}

function EEATComponent({ label, data }: { label: string; data: EEATScore }) {
  const pct = Math.round((data.score / 10) * 100);
  const barColor = data.score >= 8 ? "bg-green-500" : data.score >= 5 ? "bg-yellow-500" : "bg-red-500";
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
                <span className="text-green-600 mt-0.5 shrink-0">✓</span>{s}
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
                <span className="text-yellow-600 mt-0.5 shrink-0">→</span>{g}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

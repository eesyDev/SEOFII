import { prisma } from "@/lib/prisma";
import { fetchCompetitors, fetchKeywords, fetchDomainInfo } from "@/lib/dataforseo";
import { generateSEOBrief, generateComparisons, generateBlockMatrix, generateQuickFixes, generateReadyContent } from "@/lib/claude";
import type { SchemaResult } from "@/lib/claude";
import { generateSchemaWithGemini, analyzePageWithGemini } from "@/lib/gemini";
import type { PageStructureAnalysis } from "@/lib/gemini";
import { getPatternInsights, detectPageType } from "@/lib/nichePatterns";
import type { PatternInsight } from "@/lib/nichePatterns";
import { computeAnalytics } from "@/lib/analytics";
import { scrapePages } from "@/lib/scraper";
import { fetchPageSpeeds } from "@/lib/pagespeed";
import type { PageSpeedData } from "@/lib/pagespeed";
import type { GscRow } from "@/lib/gsc";
import type { Prisma } from "@prisma/client";

// PageSpeed не блокирует отчёт — если не успел за 20s, возвращаем пустые данные
async function fetchPageSpeedsWithTimeout(
  targetUrl: string,
  competitorUrls: string[]
): Promise<{ target: PageSpeedData; competitors: PageSpeedData[] }> {
  const empty: PageSpeedData = { score: null, lcp: null, cls: null, tbt: null, fcp: null, fetchError: "timeout" };
  const emptyResult = {
    target: empty,
    competitors: competitorUrls.map(() => empty),
  };

  try {
    return await Promise.race([
      fetchPageSpeeds(targetUrl, competitorUrls),
      new Promise<typeof emptyResult>((resolve) =>
        setTimeout(() => resolve(emptyResult), 20_000)
      ),
    ]);
  } catch {
    return emptyResult;
  }
}

export async function processReport(reportId: string) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new Error(`Report ${reportId} not found`);

  const gscRows = (report.gscData as GscRow[] | null) ?? [];

  await prisma.report.update({
    where: { id: reportId },
    data: { status: "PROCESSING" },
  });

  try {
    const user = await prisma.user.findUnique({
      where: { id: report.userId },
      select: { plan: true, isAdmin: true },
    });
    const isPro = user?.isAdmin || user?.plan === "STARTER" || user?.plan === "PRO";

    // Сначала скрапим целевую страницу чтобы взять title/H1 для поискового запроса
    const { target: targetSnapshotPre } = await scrapePages(report.url, []);
    const serpQuery = [targetSnapshotPre.h1, targetSnapshotPre.title]
      .map((s) => s?.trim())
      .find((s) => s && s.length > 3) ?? new URL(report.url).hostname;

    // Кеш DataForSEO SERP: берём конкурентов из последнего отчёта (≤7 дней) для того же URL
    const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    const cachedReport = await prisma.report.findFirst({
      where: {
        url: report.url,
        locationCode: report.locationCode,
        status: "DONE",
        id: { not: reportId },
        createdAt: { gte: new Date(Date.now() - CACHE_TTL_MS) },
      },
      include: { competitors: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    let competitors: import("@/lib/dataforseo").SerpResult[];
    let fromCache = false;

    if (cachedReport && cachedReport.competitors.length > 0) {
      competitors = cachedReport.competitors.map((c) => ({
        domain: c.domain,
        position: c.position,
        title: c.title,
        url: c.url,
        snippet: "",
      }));
      fromCache = true;
      // Копируем конкурентов в новый отчёт
      await prisma.competitor.createMany({
        data: competitors.map((c) => ({
          reportId,
          domain: c.domain,
          position: c.position,
          title: c.title,
          url: c.url,
        })),
      });
    } else {
      competitors = await fetchCompetitors(report.url, report.locationCode, serpQuery);
      await prisma.competitor.createMany({
        data: competitors.map((c) => ({
          reportId,
          domain: c.domain,
          position: c.position,
          title: c.title,
          url: c.url,
        })),
      });
    }

    console.log(`[processReport] competitors: ${fromCache ? "from cache" : "from DataForSEO"} (${competitors.length})`);

    const compareCount = isPro ? 3 : 1;
    const topCompetitors = competitors.slice(0, compareCount);
    const competitorDomains = [...new Set(competitors.map((c) => c.domain))];

    const fromTitles = competitors
      .flatMap((c) => c.title.toLowerCase().split(/\s+/))
      .filter((w) => w.length > 3);
    const fromGsc = gscRows.map((r) => r.query);
    const rawKeywords = [...new Set([...fromTitles, ...fromGsc])].slice(0, 30);

    // Всё параллельно: keywords, domains, скрапинг конкурентов, pagespeed
    // Таргет уже скрапнут выше (targetSnapshotPre), скрапим только конкурентов
    const competitorUrls = topCompetitors.map((c) => c.url);
    const [
      [_keywordData, domainInfo],
      compSnapshots,
      { target: targetSpeed, competitors: compSpeeds },
    ] = await Promise.all([
      Promise.all([fetchKeywords(rawKeywords, report.locationCode), fetchDomainInfo(competitorDomains)]),
      scrapePages(report.url, competitorUrls).then((r) => r.competitors),
      fetchPageSpeedsWithTimeout(report.url, competitorUrls),
    ]);
    const targetSnapshot = targetSnapshotPre;

    // Кеш keywords: берём из последнего отчёта если есть
    let keywordData = _keywordData;
    if (fromCache && keywordData.length === 0) {
      const cachedKeywords = await prisma.keyword.findMany({
        where: { reportId: cachedReport!.id },
        take: 30,
      });
      keywordData = cachedKeywords.map((k) => ({
        keyword: k.keyword,
        volume: k.volume,
        cpc: Number(k.cpc),
        competition: Number(k.competition),
      }));
    }

    if (keywordData.length > 0) {
      await prisma.keyword.createMany({
        data: keywordData.map((k) => ({
          reportId,
          keyword: k.keyword,
          volume: k.volume,
          cpc: k.cpc,
          competition: k.competition,
        })),
      });
    }

    const analytics = computeAnalytics(competitors, keywordData, domainInfo, gscRows);

    const siteType = targetSnapshot.siteType;

    // Бриф параллельно с comparisons+blockMatrix — brief не зависит от snapshots
    const [
      { brief, costUsd: briefCost },
      [comparisons, blockMatrix],
    ] = await Promise.all([
      generateSEOBrief(report.url, competitors, keywordData, domainInfo, analytics, gscRows, siteType, targetSnapshot),
      Promise.all([
        generateComparisons(targetSnapshot, compSnapshots, topCompetitors),
        generateBlockMatrix(targetSnapshot, compSnapshots, topCompetitors, siteType),
      ]),
    ]);

    brief.domainInfo = Object.fromEntries(
      domainInfo.map((d) => [d.domain, { domainAge: d.domainAge, referringDomains: d.referringDomains }])
    );

    const [quickFixes, schemaResult, pageStructure, readyContent] = await Promise.all([
      generateQuickFixes(report.url, brief, comparisons, analytics, siteType),
      generateSchemaWithGemini(
        report.url, brief, siteType,
        targetSnapshot.detectedBlocks,
        targetSnapshot.schemaTypes
      ),
      analyzePageWithGemini(report.url, competitorDomains),
      isPro ? generateReadyContent(report.url, brief, siteType) : Promise.resolve(null),
    ]);

    // Паттерны ниши — сравниваем с реальными блоками на странице
    const pageType = detectPageType(report.url);
    const existingBlocks = pageStructure?.existingBlocks ?? targetSnapshot.detectedBlocks;
    const nichePatterns = await getPatternInsights(
      existingBlocks, siteType, brief.targetKeyword,
      targetSnapshot.detectedBlocks, pageType
    );

    const compCost = comparisons.length * 0.015;
    const costUsd = briefCost + compCost + 0.01;

    const pageSpeed: Record<string, PageSpeedData> = {
      [report.url]: targetSpeed,
      ...Object.fromEntries(topCompetitors.map((c, i) => [c.url, compSpeeds[i]])),
    };

    const result = {
      brief,
      analytics,
      comparisons,
      blockMatrix,
      quickFixes,
      schemaResult,
      pageStructure,
      nichePatterns,
      readyContent,
      competitors,
      pageSpeed,
      siteType,
      domainInfo: Object.fromEntries(domainInfo.map((d) => [d.domain, d])),
    };

    await prisma.report.update({
      where: { id: reportId },
      data: { status: "DONE", result: result as unknown as Prisma.InputJsonValue, costUsd },
    });

    await prisma.user.update({
      where: { id: report.userId },
      data: { reportsUsed: { increment: 1 } },
    });

    return { success: true, reportId, costUsd };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "FAILED", errorMessage: message },
    });
    throw error;
  }
}

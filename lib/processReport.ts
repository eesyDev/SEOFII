import { prisma } from "@/lib/prisma";
import { fetchCompetitors, fetchKeywords, fetchDomainInfo } from "@/lib/dataforseo";
import { generateSEOBrief, generateComparisons, generateBlockMatrix, generateQuickFixes } from "@/lib/claude";
import { computeAnalytics } from "@/lib/analytics";
import { scrapePages } from "@/lib/scraper";
import type { GscRow } from "@/lib/gsc";
import type { Prisma } from "@prisma/client";

export async function processReport(reportId: string) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new Error(`Report ${reportId} not found`);

  const gscRows = (report.gscData as GscRow[] | null) ?? [];

  await prisma.report.update({
    where: { id: reportId },
    data: { status: "PROCESSING" },
  });

  try {
    // Читаем план пользователя для гейтинга сравнений
    const user = await prisma.user.findUnique({
      where: { id: report.userId },
      select: { plan: true },
    });
    const isPro = user?.plan === "STARTER" || user?.plan === "PRO";

    const competitors = await fetchCompetitors(report.url);

    await prisma.competitor.createMany({
      data: competitors.map((c) => ({
        reportId,
        domain: c.domain,
        position: c.position,
        title: c.title,
        url: c.url,
      })),
    });

    const competitorDomains = [...new Set(competitors.map((c) => c.domain))];

    const fromTitles = competitors
      .flatMap((c) => c.title.toLowerCase().split(/\s+/))
      .filter((w) => w.length > 3);
    const fromGsc = gscRows.map((r) => r.query);
    const rawKeywords = [...new Set([...fromTitles, ...fromGsc])].slice(0, 30);

    const [keywordData, domainInfo] = await Promise.all([
      fetchKeywords(rawKeywords),
      fetchDomainInfo(competitorDomains),
    ]);

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

    // Топ-1 для Free, топ-3 для Pro
    const compareCount = isPro ? 3 : 1;
    const topCompetitors = competitors.slice(0, compareCount);

    // Параллельно: бриф + скрапинг страниц
    const [{ brief, costUsd: briefCost }, { target: targetSnapshot, competitors: compSnapshots }] =
      await Promise.all([
        generateSEOBrief(report.url, competitors, keywordData, domainInfo, analytics, gscRows),
        scrapePages(report.url, topCompetitors.map((c) => c.url)),
      ]);

    brief.domainInfo = Object.fromEntries(
      domainInfo.map((d) => [
        d.domain,
        { domainAge: d.domainAge, referringDomains: d.referringDomains },
      ])
    );

    // Сравнение + матрица блоков параллельно, потом quick fixes
    const [comparisons, blockMatrix] = await Promise.all([
      generateComparisons(targetSnapshot, compSnapshots, topCompetitors),
      generateBlockMatrix(targetSnapshot, compSnapshots, topCompetitors),
    ]);
    const quickFixes = await generateQuickFixes(report.url, brief, comparisons, analytics);

    // Считаем стоимость сравнений приблизительно ($3/1M in, $15/1M out)
    const compCost = comparisons.length * 0.015;
    const fixesCost = 0.01;
    const costUsd = briefCost + compCost + fixesCost;

    const result = {
      brief,
      analytics,
      comparisons,
      blockMatrix,
      quickFixes,
      competitors,
      domainInfo: Object.fromEntries(domainInfo.map((d) => [d.domain, d])),
    };

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "DONE",
        result: result as unknown as Prisma.InputJsonValue,
        costUsd,
      },
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

import { prisma } from "@/lib/prisma";
import { fetchCompetitors, fetchKeywords } from "@/lib/dataforseo";
import { generateSEOBrief } from "@/lib/claude";
import type { Prisma } from "@prisma/client";

export async function processReport(reportId: string) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new Error(`Report ${reportId} not found`);

  await prisma.report.update({
    where: { id: reportId },
    data: { status: "PROCESSING" },
  });

  try {
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

    const rawKeywords = competitors
      .flatMap((c) => c.title.toLowerCase().split(/\s+/))
      .filter((w) => w.length > 3)
      .slice(0, 20);

    const keywordData = await fetchKeywords(rawKeywords);

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

    const { brief, costUsd } = await generateSEOBrief(report.url, competitors, keywordData);

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "DONE",
        result: brief as unknown as Prisma.InputJsonValue,
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

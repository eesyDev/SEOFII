// Логика фоновых задач для Vercel Crons (Trigger.dev не настроен).
// Каждая функция уважает бюджет времени — serverless-функция живёт максимум 300 с.

import { prisma } from "./prisma";
import { scrapePages } from "./scraper";
import { diffSnapshots, snapshotFromPage } from "./pageMonitor";
import { createAutopilotJob } from "./autopilot";
import { fetchGscRowsForPage } from "./gscApi";

const DEFAULT_BUDGET_MS = 240_000; // запас до лимита функции в 300 с

// ─────────────────────────────────────────
// Средняя позиция страницы по GSC (взвешенная по показам)
// ─────────────────────────────────────────

export async function gscAvgPosition(userId: string, pageUrl: string): Promise<number | null> {
  try {
    const rows = await fetchGscRowsForPage(userId, pageUrl);
    if (!rows || rows.length === 0) return null;
    const top = rows.sort((a, b) => b.impressions - a.impressions).slice(0, 20);
    const totalImp = top.reduce((s, r) => s + r.impressions, 0);
    if (totalImp === 0) return null;
    const weighted = top.reduce((s, r) => s + r.position * r.impressions, 0) / totalImp;
    return Math.round(weighted * 10) / 10;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────
// Еженедельный мониторинг страниц (снапшот + диф)
// ─────────────────────────────────────────

export async function runPageMonitors(budgetMs = DEFAULT_BUDGET_MS) {
  const started = Date.now();
  const monitors = await prisma.pageMonitor.findMany({
    where: { isActive: true },
    include: { snapshots: { orderBy: { takenAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "asc" }, // давно не проверявшиеся — первыми
    take: 50,
  });

  let scraped = 0;
  let changesFound = 0;

  for (const monitor of monitors) {
    if (Date.now() - started > budgetMs) break;
    try {
      const { target } = await scrapePages(monitor.url, []);
      if (target.fetchError) continue;

      const newSnap = snapshotFromPage(target);
      await prisma.pageSnapshotRecord.create({ data: { monitorId: monitor.id, ...newSnap } });
      await prisma.pageMonitor.update({ where: { id: monitor.id }, data: { updatedAt: new Date() } });
      scraped++;

      const lastSnap = monitor.snapshots[0];
      if (!lastSnap) continue;
      const diffs = diffSnapshots(lastSnap, newSnap);
      if (diffs.length > 0) {
        await prisma.detectedChange.createMany({
          data: diffs.map((d) => ({ monitorId: monitor.id, ...d })),
        });
        changesFound += diffs.length;
      }
    } catch (err) {
      console.warn(`[cron] monitor failed for ${monitor.url}:`, err);
    }
  }
  return { monitors: monitors.length, scraped, changesFound };
}

// ─────────────────────────────────────────
// Еженедельная проверка вотчей конкурентов
// ─────────────────────────────────────────

export async function runCompetitorWatches(budgetMs = DEFAULT_BUDGET_MS) {
  const { scrapeCompetitorPage, diffSnapshots: diffWatch, generateChangeSummary } = await import("./competitorWatch");
  const started = Date.now();

  const watches = await prisma.competitorWatch.findMany({
    where: { isActive: true },
    include: { snapshots: { orderBy: { takenAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "asc" },
    take: 30,
  });

  let alerts = 0;
  let checked = 0;

  for (const watch of watches) {
    if (Date.now() - started > budgetMs) break;
    try {
      const current = await scrapeCompetitorPage(watch.url);
      const last = watch.snapshots[0];

      await prisma.competitorSnapshot.create({
        data: {
          watchId: watch.id,
          title: current.title,
          wordCount: current.wordCount,
          headings: current.headings,
          blocks: current.blocks,
          contentHash: current.contentHash,
          rawText: current.rawText,
        },
      });
      await prisma.competitorWatch.update({ where: { id: watch.id }, data: { updatedAt: new Date() } });
      checked++;
      if (!last) continue;

      const previous = {
        title: last.title,
        wordCount: last.wordCount,
        headings: last.headings,
        blocks: last.blocks,
        contentHash: last.contentHash,
        rawText: last.rawText,
      };
      const result = diffWatch(previous, current);
      if (result) {
        const summary = await generateChangeSummary(watch.label, watch.url, previous, current, result.diff);
        await prisma.competitorAlert.create({
          data: { watchId: watch.id, changeType: result.changeType, summary, diff: result.diff },
        });
        alerts++;
      }
    } catch (err) {
      console.warn(`[cron] watch failed for ${watch.label}:`, err);
    }
  }
  return { watches: watches.length, checked, alerts };
}

// ─────────────────────────────────────────
// Плановый автопилот: активные сайты без свежего джоба за 7 дней
// ─────────────────────────────────────────

export async function runScheduledAutopilots(budgetMs = DEFAULT_BUDGET_MS) {
  const started = Date.now();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const sites = await prisma.siteConnection.findMany({
    where: {
      isActive: true,
      config: { is: { isEnabled: true } },
      jobs: { none: { createdAt: { gte: weekAgo } } },
    },
    take: 5,
  });

  let ran = 0;
  for (const site of sites) {
    if (Date.now() - started > budgetMs) break;
    try {
      await createAutopilotJob(site.id);
      ran++;
    } catch (err) {
      console.warn(`[cron] autopilot failed for site ${site.id}:`, err);
    }
  }
  return { eligible: sites.length, ran };
}

// ─────────────────────────────────────────
// Outcome: для применённых правок замеряем позицию «после» через 7+ дней
// ─────────────────────────────────────────

export async function updateAutopilotOutcomes() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const changes = await prisma.autoPilotChange.findMany({
    where: {
      status: "APPLIED",
      appliedAt: { lte: sevenDaysAgo },
      rankingAfter: null,
      rankingBefore: { not: null },
    },
    include: { job: { include: { site: { select: { userId: true } } } } },
    take: 30,
  });

  let updated = 0;
  for (const change of changes) {
    const after = await gscAvgPosition(change.job.site.userId, change.pageUrl);
    if (after !== null) {
      await prisma.autoPilotChange.update({
        where: { id: change.id },
        data: { rankingAfter: after },
      });
      updated++;
    }
  }
  return { candidates: changes.length, updated };
}

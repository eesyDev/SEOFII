import { schedules, logger } from "@trigger.dev/sdk/v3";
import { prisma } from "@/lib/prisma";
import { scrapePages } from "@/lib/scraper";
import { diffSnapshots, snapshotFromPage } from "@/lib/pageMonitor";

export const weeklyMonitorTask = schedules.task({
  id: "weekly-page-monitor",
  cron: "0 9 * * 1", // каждый понедельник 9:00 UTC
  maxDuration: 600,
  run: async () => {
    const monitors = await prisma.pageMonitor.findMany({
      where: { isActive: true },
      include: {
        snapshots: {
          orderBy: { takenAt: "desc" },
          take: 1,
        },
      },
    });

    logger.info(`Weekly monitor: ${monitors.length} активных страниц`);

    let scraped = 0;
    let changesFound = 0;

    for (const monitor of monitors) {
      try {
        const { target } = await scrapePages(monitor.url, []);

        if (target.fetchError) {
          logger.warn(`Scrape failed: ${monitor.url} — ${target.fetchError}`);
          continue;
        }

        const newSnap = snapshotFromPage(target);

        await prisma.pageSnapshotRecord.create({
          data: {
            monitorId: monitor.id,
            ...newSnap,
          },
        });

        scraped++;

        const lastSnap = monitor.snapshots[0];
        if (!lastSnap) continue;

        const diffs = diffSnapshots(lastSnap, newSnap);

        if (diffs.length > 0) {
          await prisma.detectedChange.createMany({
            data: diffs.map((d) => ({ monitorId: monitor.id, ...d })),
          });
          changesFound += diffs.length;
          logger.info(`${monitor.url}: ${diffs.length} изменений`);
        }
      } catch (err) {
        logger.error(`Monitor error for ${monitor.url}`, { error: String(err) });
      }
    }

    logger.info(`Done: ${scraped} страниц проверено, ${changesFound} изменений`);
    return { scraped, changesFound };
  },
});

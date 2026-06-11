import { schedules, logger } from "@trigger.dev/sdk/v3";
import { prisma } from "@/lib/prisma";
import {
  scrapeCompetitorPage,
  diffSnapshots,
  generateChangeSummary,
} from "@/lib/competitorWatch";

export const competitorMonitorTask = schedules.task({
  id: "competitor-monitor",
  cron: "0 8 * * 2", // every Tuesday 8am UTC
  maxDuration: 600,
  run: async () => {
    const watches = await prisma.competitorWatch.findMany({
      where: { isActive: true },
      include: {
        snapshots: {
          orderBy: { takenAt: "desc" },
          take: 1,
        },
      },
    });

    logger.info(`Checking ${watches.length} competitor watches`);

    let alertCount = 0;

    for (const watch of watches) {
      try {
        const current = await scrapeCompetitorPage(watch.url);

        const lastSnapshot = watch.snapshots[0];

        if (!lastSnapshot) {
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
          logger.info(`Initial snapshot saved for ${watch.label}`);
          continue;
        }

        const previous = {
          title: lastSnapshot.title,
          wordCount: lastSnapshot.wordCount,
          headings: lastSnapshot.headings,
          blocks: lastSnapshot.blocks,
          contentHash: lastSnapshot.contentHash,
          rawText: lastSnapshot.rawText,
        };

        const result = diffSnapshots(previous, current);

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

        if (result) {
          const summary = await generateChangeSummary(
            watch.label,
            watch.url,
            previous,
            current,
            result.diff
          );

          await prisma.competitorAlert.create({
            data: {
              watchId: watch.id,
              changeType: result.changeType,
              summary,
              diff: result.diff,
            },
          });

          alertCount++;
          logger.info(`Alert created for ${watch.label}: ${result.changeType}`);
        }
      } catch (err) {
        logger.error(`Failed to check ${watch.label}: ${String(err)}`);
      }
    }

    logger.info(`Done. ${alertCount} alerts created.`);
    return { checked: watches.length, alerts: alertCount };
  },
});

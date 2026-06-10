import { task, logger } from "@trigger.dev/sdk/v3";
import { createAutopilotJob } from "@/lib/autopilot";
import { applyAllApproved } from "@/lib/autopilot";

interface AutopilotPayload {
  siteId: string;
  autoApply?: boolean;
}

export const autopilotTask = task({
  id: "autopilot-run",
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 10_000,
  },
  run: async ({ siteId, autoApply = false }: AutopilotPayload) => {
    logger.info("Starting autopilot analysis", { siteId });

    // Step 1: Analyze site and generate changes
    const job = await createAutopilotJob(siteId);
    logger.info("Autopilot analysis complete", {
      jobId: job.id,
      pagesAnalyzed: job.pageCount,
      changesGenerated: job.changeCount,
    });

    // Step 2: Auto-apply if configured
    if (autoApply && job.changeCount > 0) {
      logger.info("Auto-applying approved changes", { jobId: job.id });
      const results = await applyAllApproved(job.id);
      const applied = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      logger.info("Auto-apply complete", { applied, failed });
      return { jobId: job.id, changesGenerated: job.changeCount, applied, failed };
    }

    return { jobId: job.id, changesGenerated: job.changeCount, applied: 0, failed: 0 };
  },
});

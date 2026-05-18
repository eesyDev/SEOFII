import { task, logger } from "@trigger.dev/sdk/v3";
import { processReport } from "@/lib/processReport";

interface GenerateReportPayload {
  reportId: string;
}

export const generateReportTask = task({
  id: "generate-report",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5_000,
  },
  run: async ({ reportId }: GenerateReportPayload) => {
    logger.info("Начинаем генерацию отчёта", { reportId });
    const result = await processReport(reportId);
    logger.info("Отчёт сгенерирован", { reportId, costUsd: result.costUsd });
    return result;
  },
});

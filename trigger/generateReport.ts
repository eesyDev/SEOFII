// Trigger.dev фоновая задача: генерация SEO-отчёта
// Запускается асинхронно после создания записи Report в БД
import { task, logger } from "@trigger.dev/sdk/v3";
import { prisma } from "@/lib/prisma";
import { fetchCompetitors, fetchKeywords } from "@/lib/dataforseo";
import { generateSEOBrief } from "@/lib/claude";

interface GenerateReportPayload {
  reportId: string;
}

export const generateReportTask = task({
  id: "generate-report",
  // Повторные попытки при сбое (DataForSEO/Claude могут временно недоступны)
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5_000,
  },

  run: async (payload: GenerateReportPayload) => {
    const { reportId } = payload;

    // ─────────────────────────────────────────
    // ШАГ 0: Получаем отчёт из БД
    // ─────────────────────────────────────────
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error(`Report ${reportId} не найден`);
    }

    logger.info("Начинаем генерацию отчёта", { reportId, url: report.url });

    // Ставим статус processing
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "PROCESSING" },
    });

    try {
      // ─────────────────────────────────────────
      // ШАГ 1: Получаем топ-10 конкурентов из DataForSEO
      // ─────────────────────────────────────────
      logger.info("Шаг 1: запрос конкурентов из DataForSEO");

      const competitors = await fetchCompetitors(report.url);

      // Сохраняем конкурентов в БД (пригодятся для v2 мониторинга)
      await prisma.competitor.createMany({
        data: competitors.map((c) => ({
          reportId,
          domain: c.domain,
          position: c.position,
          title: c.title,
          url: c.url,
        })),
      });

      logger.info(`Найдено ${competitors.length} конкурентов`);

      // ─────────────────────────────────────────
      // ШАГ 2: Получаем ключевые слова
      // ─────────────────────────────────────────
      logger.info("Шаг 2: запрос ключевых слов");

      // Берём заголовки конкурентов как источник ключевых слов
      const rawKeywords = competitors
        .flatMap((c) => c.title.toLowerCase().split(/\s+/))
        .filter((w) => w.length > 3)
        .slice(0, 20); // DataForSEO принимает до 1000, но нам хватит 20 для старта

      const keywordData = await fetchKeywords(rawKeywords);

      // Сохраняем ключевые слова
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

      logger.info(`Получено ${keywordData.length} ключевых слов`);

      // ─────────────────────────────────────────
      // ШАГ 3: Отправляем в Claude, получаем ТЗ
      // ─────────────────────────────────────────
      logger.info("Шаг 3: генерация ТЗ через Claude API");

      const { brief, costUsd } = await generateSEOBrief(
        report.url,
        competitors,
        keywordData
      );

      logger.info("ТЗ сгенерировано", { costUsd });

      // ─────────────────────────────────────────
      // ШАГ 4: Сохраняем результат, ставим статус done
      // ─────────────────────────────────────────
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: "DONE",
          result: brief,
          costUsd,
        },
      });

      // Увеличиваем счётчик использованных отчётов у пользователя
      await prisma.user.update({
        where: { id: report.userId },
        data: { reportsUsed: { increment: 1 } },
      });

      logger.info("Отчёт успешно сгенерирован", { reportId });

      return { success: true, reportId, costUsd };
    } catch (error) {
      // При ошибке ставим статус failed с описанием
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";

      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: "FAILED",
          errorMessage: message,
        },
      });

      logger.error("Ошибка генерации отчёта", { reportId, error: message });

      // Пробрасываем ошибку для retry-механизма Trigger.dev
      throw error;
    }
  },
});

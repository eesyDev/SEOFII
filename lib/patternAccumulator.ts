import { prisma } from "./prisma";
import type { PageSnapshot } from "./scraper";
import type { PageType } from "./nichePatterns";

// Маппинг: scraper detectedBlocks → nichePattern IDs
const BLOCK_TO_PATTERN: Record<string, { id: string; type: string; label: string; rationale: string }> = {
  calculator:       { id: "calculator",           type: "conversion", label: "Калькулятор стоимости",           rationale: "Позволяет пользователю мгновенно оценить бюджет без звонка менеджеру" },
  gallery:          { id: "portfolio_gallery",     type: "trust",      label: "Галерея работ / портфолио",       rationale: "Визуальное доказательство качества — снижает барьер для первого контакта" },
  reviews:          { id: "reviews_testimonials",  type: "trust",      label: "Отзывы и рейтинги",               rationale: "Главный инструмент доверия: реальные отзывы влияют на 88% решений о покупке" },
  price:            { id: "price_table",           type: "conversion", label: "Цены / прайс-лист",               rationale: "Прозрачность цен снижает отказы и отсекает нецелевых посетителей" },
  form:             { id: "cta_form",              type: "conversion", label: "Форма захвата лидов",             rationale: "Прямой инструмент конверсии — убирает шаг звонка для осторожного клиента" },
  team:             { id: "team_profiles",         type: "trust",      label: "Профили команды / специалистов",  rationale: "E-E-A-T сигнал: лица и регалии специалистов повышают экспертность в глазах Google и клиентов" },
  faq:              { id: "faq_section",           type: "content",    label: "FAQ / раздел вопросов-ответов",   rationale: "Попадание в People Also Ask, снижение нагрузки на менеджеров" },
  video:            { id: "video_block",           type: "content",    label: "Видео-блок",                      rationale: "Увеличивает время на сайте и наглядно показывает процесс / результат" },
  comparison_table: { id: "comparison_table",      type: "content",    label: "Таблица сравнения",               rationale: "Помогает выбрать и удерживает на сайте — пользователь не уходит на сравнение к конкурентам" },
  social_proof:     { id: "social_proof_counter",  type: "trust",      label: "Счётчик клиентов / заказов",      rationale: "Эффект толпы: большое число клиентов снимает страх первого заказа" },
};

// EMA-коэффициент: насколько сильно новое наблюдение сдвигает накопленную частоту.
// 0.25 = новое наблюдение имеет вес ~25%, история — 75%.
const EMA_ALPHA = 0.25;

// Порог авто-апрува при обновлении существующей записи
const AUTO_APPROVE_THRESHOLD = 0.6;

/**
 * Накапливает паттерны конкурентов в базу знаний ниш.
 * Вызывается fire-and-forget в конце processReport.
 *
 * Логика:
 * - считает frequency каждого блока по скрапнутым страницам конкурентов
 * - фильтрует блоки с frequency < 0.3 (шум)
 * - для существующих записей: EMA-обновление + авто-апрув если freq >= 0.6
 * - для новых: создаёт со статусом pending (апрув — вручную или по накоплению)
 */
export async function accumulatePatterns(
  niche: string,
  pageType: PageType,
  compSnapshots: PageSnapshot[]
): Promise<void> {
  const validSnapshots = compSnapshots.filter((s) => !s.fetchError);
  if (validSnapshots.length === 0 || niche === "general") return;

  const total = validSnapshots.length;

  // Считаем сколько конкурентов имеют каждый блок
  const blockCounts: Record<string, { count: number; evidence: string[] }> = {};
  for (const snapshot of validSnapshots) {
    for (const block of snapshot.detectedBlocks) {
      if (!blockCounts[block]) blockCounts[block] = { count: 0, evidence: [] };
      blockCounts[block].count++;
      try {
        blockCounts[block].evidence.push(new URL(snapshot.url).hostname);
      } catch {
        blockCounts[block].evidence.push(snapshot.url);
      }
    }
  }

  // Строим список наблюдений с частотами
  const observations: Array<{
    patternId: string;
    patternType: string;
    label: string;
    rationale: string;
    frequency: number;
    evidence: string[];
  }> = [];

  for (const [scraperBlock, { count, evidence }] of Object.entries(blockCounts)) {
    const mapping = BLOCK_TO_PATTERN[scraperBlock];
    if (!mapping) continue;

    const frequency = parseFloat((count / total).toFixed(2));
    if (frequency < 0.3) continue; // шум — игнорируем

    observations.push({
      patternId: mapping.id,
      patternType: mapping.type,
      label: mapping.label,
      rationale: mapping.rationale,
      frequency,
      evidence: [...new Set(evidence)],
    });
  }

  if (observations.length === 0) return;

  // Загружаем существующие паттерны для этой ниши+pageType одним запросом
  const existingPatterns = await prisma.nichePattern.findMany({
    where: { niche, pageType },
    select: { id: true, pattern: true, frequency: true, confidence: true },
  });
  const existingMap = new Map(existingPatterns.map((p) => [p.pattern, p]));

  const toCreate: Parameters<typeof prisma.nichePattern.create>[0]["data"][] = [];
  const toUpdate: Array<{ id: string; frequency: number; confidence: string; evidence: string[] }> = [];

  for (const obs of observations) {
    const existing = existingMap.get(obs.patternId);

    if (existing) {
      const newFreq = parseFloat((existing.frequency * (1 - EMA_ALPHA) + obs.frequency * EMA_ALPHA).toFixed(2));
      // Апрувим если уже накоплено достаточно данных и частота высокая
      const newConfidence =
        newFreq >= AUTO_APPROVE_THRESHOLD && existing.confidence === "pending"
          ? "approved"
          : existing.confidence;

      toUpdate.push({ id: existing.id, frequency: newFreq, confidence: newConfidence, evidence: obs.evidence });
    } else {
      toCreate.push({
        niche,
        pattern: obs.patternId,
        patternType: obs.patternType,
        pageType,
        frequency: obs.frequency,
        evidence: obs.evidence,
        confidence: "pending",
        context: `${obs.label}: ${obs.rationale}`,
      });
    }
  }

  // Записываем параллельно
  await Promise.all([
    toCreate.length > 0
      ? prisma.nichePattern.createMany({ data: toCreate, skipDuplicates: true })
      : Promise.resolve(),
    ...toUpdate.map(({ id, frequency, confidence, evidence }) =>
      prisma.nichePattern.update({
        where: { id },
        data: { frequency, confidence, evidence },
      })
    ),
  ]);
}

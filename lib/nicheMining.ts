import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "./prisma";
import type { CleanedPage } from "./markdownClean";

const MINING_MODEL = process.env.GEMINI_MINING_MODEL ?? "gemini-2.5-flash";
const MINING_API_KEY = process.env.GEMINI_MINING_API_KEY ?? process.env.GEMINI_API_KEY ?? "";

const USE_MOCK = !MINING_API_KEY;

// Строго фиксированные ID блоков — никакого хаоса в БД
const CORE_BLOCK_NAMES = [
  "calculator",
  "portfolio_gallery",
  "reviews_testimonials",
  "price_table",
  "cta_form",
  "trust_badges",
  "team_profiles",
  "faq_section",
  "video_block",
  "comparison_table",
  "social_proof_counter",
  "lead_magnet",
  "other_specialized_block",
];

interface MiningResult {
  niche: string;
  analyzedDomains: string[];
  patterns: Array<{
    name: string;
    label: string;
    frequency: number;
    evidence: string[];
    rationale: string;
    blockType: "conversion" | "trust" | "content" | "technical" | "navigation";
  }>;
  rejected?: string[];
}

async function getApprovedExamples(niche: string, limit = 8): Promise<string> {
  const patterns = await prisma.nichePattern.findMany({
    where: { confidence: "approved" },
    orderBy: { frequency: "desc" },
    take: limit,
  });

  if (patterns.length === 0) return "";

  return `
Примеры уже подтверждённых паттернов из других ниш (ориентир качества):
${patterns
  .map((p) => `- ${p.pattern} (${p.patternType}): ${p.context ?? ""}`)
  .join("\n")}`;
}

function buildPrompt(niche: string, pages: CleanedPage[], examples: string): string {
  const pagesBlock = pages
    .map(
      (p, i) =>
        `=== САЙТ ${i + 1}: ${p.domain} ===\nЗаголовки: ${p.headings.join(
          " | "
        )}\nКнопки/CTA: ${p.buttons.join(" | ")}\n\nТекст страницы:\n${p.markdown}`
    )
    .join("\n\n---\n\n");

  return `Ты — эксперт по коммерческим факторам ранжирования сайтов и SEO-аналитик.

ЗАДАЧА: Проанализируй Markdown-структуру страниц сайтов в нише "${niche}". Зафиксируй наличие ключевых коммерческих, контентных и конверсионных блоков на каждом домене.

ПРАВИЛА АНАЛИЗА:
1. Игнорируй элементы сквозной навигации: шапку (header), подвал (footer), меню, cookie-баннеры, виджеты соцсетей.
2. Не придумывай новые типы блоков в поле 'name', если они подходят под категории из списка. Используй 'other_specialized_block' только для уникальных нишевых фич.
3. В массив 'evidence' добавляй домен сайта ТОЛЬКО если ты на 100% уверен, что данный блок присутствует на его страницах.
4. Минимальный порог: блок должен быть как минимум на 30% проанализированных сайтов, иначе это шум.${examples}

ДОСТУПНЫЕ ТИПЫ БЛОКОВ (выбирай строго из списка):
- calculator: калькуляторы стоимости, расчёты
- portfolio_gallery: фото работ, до/после, кейсы
- reviews_testimonials: отзывы, рейтинги, видео-отзывы
- price_table: таблицы цен, прайс-листы
- cta_form: формы заявки, обратной связи, захвата лидов
- trust_badges: логотипы партнёров, сертификаты, награды
- team_profiles: страницы команды, фото экспертов
- faq_section: FAQ, аккордеоны с вопросами-ответами
- video_block: видео-обзоры, презентации
- comparison_table: сравнительные таблицы (товаров, услуг)
- social_proof_counter: счётчики клиентов, заказов
- lead_magnet: бесплатные материалы, чек-листы, гайды
- other_specialized_block: уникальный блок, не подходящий под категории выше

АНАЛИЗИРУЕМЫЕ СТРАНИЦЫ:
${pagesBlock}`;
}

function getMockResult(niche: string, pages: CleanedPage[]): MiningResult {
  const domains = pages.map((p) => p.domain);
  const total = domains.length || 1;
  return {
    niche,
    analyzedDomains: domains,
    patterns: [
      {
        name: "calculator",
        label: "Калькулятор стоимости",
        frequency: Math.round((2 / total) * 100) / 100,
        evidence: domains.slice(0, 2),
        rationale: "Позволяет пользователю мгновенно оценить бюджет без звонка менеджеру",
        blockType: "conversion",
      },
      {
        name: "portfolio_gallery",
        label: "Галерея до/после",
        frequency: Math.round((2 / total) * 100) / 100,
        evidence: domains.slice(0, 2),
        rationale: "Визуальное доказательство качества работы, повышает доверие",
        blockType: "trust",
      },
      {
        name: "faq_section",
        label: "FAQ с schema.org",
        frequency: Math.round((3 / total) * 100) / 100,
        evidence: domains.slice(0, 3),
        rationale: "Попадание в блок People Also Ask Google, снижение нагрузки на менеджеров",
        blockType: "content",
      },
    ].filter((p) => p.frequency >= 0.3) as MiningResult["patterns"],
    rejected: ["cookie_banner", "footer_links", "social_share"],
  };
}

/**
 * Добыча паттернов ниши через Gemini Flash (Tier-2).
 * Frequency считается на бэкенде — LLM только находит факты.
 */
export async function minePatternsFromNiche(
  niche: string,
  pages: CleanedPage[]
): Promise<MiningResult> {
  if (USE_MOCK) {
    console.log("[MOCK] Niche mining — нет GEMINI_API_KEY");
    return getMockResult(niche, pages);
  }

  const examples = await getApprovedExamples(niche);
  const prompt = buildPrompt(niche, pages, examples);

  const ai = new GoogleGenAI({ apiKey: MINING_API_KEY });

  const schema = {
    type: Type.OBJECT,
    properties: {
      niche: { type: Type.STRING },
      analyzedDomains: { type: Type.ARRAY, items: { type: Type.STRING } },
      patterns: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, enum: CORE_BLOCK_NAMES },
            label: { type: Type.STRING },
            evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
            rationale: { type: Type.STRING },
            blockType: {
              type: Type.STRING,
              enum: ["conversion", "trust", "content", "technical", "navigation"],
            },
          },
          required: ["name", "label", "evidence", "rationale", "blockType"],
        },
      },
    },
    required: ["niche", "analyzedDomains", "patterns"],
  };

  // Retry при 503 с fallback на gemini-2.0-flash
  const modelsToTry = [MINING_MODEL, "gemini-2.0-flash"];
  let lastError: unknown;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0 || model !== MINING_MODEL) {
          console.log(`  [retry] model=${model} attempt=${attempt + 1}`);
          await new Promise((r) => setTimeout(r, (attempt + 1) * 5000));
        }
        const result = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        });

        const rawData = JSON.parse(result.text ?? "{}") as {
          niche: string;
          analyzedDomains: string[];
          patterns: Array<{
            name: string;
            label: string;
            evidence: string[];
            rationale: string;
            blockType: "conversion" | "trust" | "content" | "technical" | "navigation";
          }>;
        };

        const totalSites = rawData.analyzedDomains.length || 1;
        const patterns = rawData.patterns
          .map((p) => ({
            ...p,
            frequency: Number((p.evidence.length / totalSites).toFixed(2)),
          }))
          .filter((p) => p.frequency >= 0.3);

        return { niche: rawData.niche, analyzedDomains: rawData.analyzedDomains, patterns };
      } catch (err: unknown) {
        lastError = err;
        const status = (err as { status?: number })?.status;
        if (status !== 503 && status !== 429) throw err; // не ретраим на другие ошибки
      }
    }
  }

  throw lastError;
}

/**
 * Сохраняет добытые паттерны в базу со статусом pending
 */
export async function savePatternsToDb(
  niche: string,
  result: MiningResult
): Promise<number> {
  const data = result.patterns.map((p) => ({
    niche,
    pattern: p.name,
    patternType: p.blockType,
    frequency: p.frequency,
    evidence: p.evidence,
    confidence: "pending" as const,
    context: `${p.label}: ${p.rationale}`,
  }));

  if (data.length === 0) return 0;

  await prisma.nichePattern.createMany({
    data,
    skipDuplicates: false,
  });

  return data.length;
}

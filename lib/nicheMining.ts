import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "./prisma";
import type { CleanedPage } from "./markdownClean";

const MINING_MODEL = process.env.GEMINI_MINING_MODEL ?? "gemini-2.5-flash";
const MINING_API_KEY = process.env.GEMINI_MINING_API_KEY ?? process.env.GEMINI_API_KEY ?? "";

const USE_MOCK = !MINING_API_KEY;

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
  rejected: string[];
}

/**
 * Берём уже одобренные паттерны из базы как few-shot примеры
 */
async function getApprovedExamples(niche: string, limit = 8): Promise<string> {
  const patterns = await prisma.nichePattern.findMany({
    where: { confidence: "approved" },
    orderBy: { frequency: "desc" },
    take: limit,
  });

  if (patterns.length === 0) return "";

  return `
Примеры уже подтверждённых паттернов из других ниш (используй как ориентир качества):
${patterns
  .map((p) => `- ${p.pattern} (${p.patternType}, freq: ${p.frequency}): ${p.context ?? ""}`)
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

  return `Ты — SEO-аналитик, специализирующийся на изучении паттернов успешных сайтов.

ЗАДАЧА: Проанализируй структуру страниц из нише "${niche}" и выяви повторяющиеся контентные/конверсионные блоки.

ЖЁСТКИЕ ПРАВИЛА:
1. Анализируй ТОЛЬКО коммерческие и контентные блоки (калькуляторы, формы, галереи, FAQ, отзывы, таблицы, видео, кейсы, портфолио)
2. ИГНОРИРУЙ полностью: cookie-баннеры, футеры, хедеры, навигацию, корзины, логины, регистрацию, социальные сети, подписки на рассылку
3. ИГНОРИРУЙ агрегаторы: если видишь "Объявления", "Список исполнителей", "Фильтры по 100 параметрам" — это маркетплейс, не считай
4. Частота = (сайтов с блоком) / (всего проанализировано). Округляй до 2 знаков
5. Минимальный порог для включения: frequency >= 0.3 (3+ сайта из 10)
6. Если блок есть у 1-2 сайтов — это шум, не включай
7. Давай конкретные machine-friendly ID: cost_calculator, before_after_gallery, faq_schema, client_logos, video_testimonial
8. blockType: conversion (увеличивает продажи), trust (доверие), content (информация), technical (разметка), navigation (структура)
${examples}

АНАЛИЗИРУЕМЫЕ СТРАНИЦЫ:
${pagesBlock}

Отвечай СТРОГО в формате JSON по предоставленной схеме. Без markdown-обёртки, без пояснений.`;
}

function getMockResult(niche: string, pages: CleanedPage[]): MiningResult {
  const domains = pages.map((p) => p.domain);
  return {
    niche,
    analyzedDomains: domains,
    patterns: [
      {
        name: "cost_calculator",
        label: "Калькулятор стоимости",
        frequency: 0.6,
        evidence: domains.slice(0, 2),
        rationale: "Позволяет пользователю мгновенно оценить бюджет без звонка менеджеру",
        blockType: "conversion",
      },
      {
        name: "before_after_gallery",
        label: "Галерея до/после",
        frequency: 0.5,
        evidence: domains.slice(0, 2),
        rationale: "Визуальное доказательство качества работы, повышает доверие",
        blockType: "trust",
      },
      {
        name: "faq_section",
        label: "FAQ с schema.org",
        frequency: 0.7,
        evidence: domains.slice(0, 3),
        rationale: "Попадание в блок People Also Ask Google, снижение нагрузки на менеджеров",
        blockType: "content",
      },
    ],
    rejected: ["cookie_banner", "footer_links", "social_share"],
  };
}

/**
 * Добыча паттернов ниши через Gemini Flash (Tier-2)
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

  const result = await ai.models.generateContent({
    model: MINING_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          niche: { type: Type.STRING },
          analyzedDomains: { type: Type.ARRAY, items: { type: Type.STRING } },
          patterns: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                label: { type: Type.STRING },
                frequency: { type: Type.NUMBER },
                evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
                rationale: { type: Type.STRING },
                blockType: {
                  type: Type.STRING,
                  enum: ["conversion", "trust", "content", "technical", "navigation"],
                },
              },
              required: ["name", "label", "frequency", "evidence", "rationale", "blockType"],
            },
          },
          rejected: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["niche", "analyzedDomains", "patterns", "rejected"],
      },
    },
  });

  const text = result.text ?? "{}";
  const parsed = JSON.parse(text) as MiningResult;

  // Фильтруем минимальный порог
  parsed.patterns = parsed.patterns.filter((p) => p.frequency >= 0.3);

  return parsed;
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

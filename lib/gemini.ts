import { GoogleGenAI } from "@google/genai";
import type { SEOBrief, SchemaResult } from "./claude";
import type { SiteType } from "./scraper";

// ─────────────────────────────────────────
// ТИПЫ: анализ структуры страницы
// ─────────────────────────────────────────

export interface PageBlock {
  name: string;        // "Калькулятор стоимости", "FAQ", "Блок отзывов"
  present: boolean;    // есть на странице?
  priority: "high" | "medium" | "low";
  rationale: string;  // зачем добавить / почему важно
}

export interface PageStructureAnalysis {
  existingBlocks: string[];     // что есть
  recommendedBlocks: PageBlock[]; // что добавить
  siteType: SiteType;
  summary: string;              // 1-2 предложения общего вывода
}

const apiKey = process.env.GEMINI_API_KEY ?? "";
const USE_MOCK = !apiKey;

function getClient() {
  return new GoogleGenAI({ apiKey });
}

function stripJsonFences(text: string): string {
  const t = text.trim();
  const firstBrace = t.indexOf("{");
  const firstBracket = t.indexOf("[");
  if (firstBrace === -1 && firstBracket === -1) return t;
  const isObj = firstBracket === -1 || (firstBrace !== -1 && firstBrace < firstBracket);
  const start = isObj ? firstBrace : firstBracket;
  const end = isObj ? t.lastIndexOf("}") : t.lastIndexOf("]");
  if (end === -1 || end < start) return t;
  return t.slice(start, end + 1);
}

function getMockSchemaResult(): SchemaResult {
  return {
    schemas: [
      {
        type: "LocalBusiness",
        description: "Основная разметка организации — появляется в Картах и Knowledge Panel",
        code: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": "[ЗАПОЛНИТЬ: название компании]",
          "url": "[ЗАПОЛНИТЬ: URL]",
          "telephone": "[ЗАПОЛНИТЬ: телефон]",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "[ЗАПОЛНИТЬ: город]",
            "addressCountry": "RU",
          },
        }, null, 2),
      },
    ],
  };
}

// ─────────────────────────────────────────
// АНАЛИЗ СТРУКТУРЫ СТРАНИЦЫ
// ─────────────────────────────────────────

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const html = await res.text();
    // Обрезаем до 80К символов — достаточно для анализа структуры
    return html.slice(0, 80_000);
  } catch {
    return null;
  }
}

function getMockPageAnalysis(): PageStructureAnalysis {
  return {
    existingBlocks: ["Форма заявки", "Прайс-лист", "Контакты"],
    recommendedBlocks: [
      { name: "Блок отзывов с рейтингом", present: false, priority: "high", rationale: "Отзывы с оценками формируют доверие и дают сигналы E-E-A-T. У большинства конкурентов в топе есть AggregateRating." },
      { name: "FAQ-раздел", present: false, priority: "high", rationale: "FAQ появляется в расширенных сниппетах Google и увеличивает CTR. Отвечает на типовые вопросы аудитории перед заказом." },
      { name: "Портфолио / фото работ", present: false, priority: "medium", rationale: "Визуальные примеры работ повышают конверсию и время на сайте." },
    ],
    siteType: "local",
    summary: "Страница имеет базовую структуру, но не хватает социальных доказательств и FAQ.",
  };
}

export async function analyzePageWithGemini(url: string, competitorDomains: string[] = []): Promise<PageStructureAnalysis> {
  if (USE_MOCK) return getMockPageAnalysis();

  const html = await fetchHtml(url);
  if (!html) return getMockPageAnalysis();

  const competitorsHint = competitorDomains.length > 0
    ? `Конкуренты в топе: ${competitorDomains.slice(0, 5).join(", ")}`
    : "";

  const prompt = `Ты — SEO-специалист и UX-эксперт. Проанализируй HTML страницы и определи её структуру.

URL: ${url}
${competitorsHint}

HTML СТРАНИЦЫ (первые 80К символов):
${html}

Задача:
1. Определи какие блоки/секции уже есть на странице (перечисли конкретно: "Форма заявки", "Блок цен", "Галерея работ", "FAQ", "Отзывы", "Калькулятор", "Карта", "Видео", "Сертификаты/лицензии" и т.д.)
2. Определи тип сайта: "ecommerce" | "local" | "content"
3. Предложи 4–6 блоков которых НЕТ, но которые стоит добавить для улучшения SEO и конверсии

Для каждого рекомендуемого блока:
- name: конкретное название ("Блок с отзывами и рейтингом", "Калькулятор стоимости", "FAQ-раздел")
- present: false
- priority: "high" | "medium" | "low"
- rationale: 1–2 предложения ПОЧЕМУ это важно для SEO и/или конверсии

Отвечай ТОЛЬКО JSON:
{
  "existingBlocks": ["..."],
  "recommendedBlocks": [
    { "name": "...", "present": false, "priority": "high", "rationale": "..." }
  ],
  "siteType": "local",
  "summary": "1–2 предложения общего вывода"
}`;

  try {
    const ai = getClient();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const text = result.text ?? "";
    return JSON.parse(stripJsonFences(text)) as PageStructureAnalysis;
  } catch (err) {
    console.error("Gemini page analysis error:", err instanceof Error ? err.message : err);
    return getMockPageAnalysis();
  }
}

export async function generateSchemaWithGemini(
  url: string,
  brief: SEOBrief,
  siteType: SiteType,
  detectedBlocks: string[] = [],
  existingSchemas: string[] = []
): Promise<SchemaResult> {
  if (USE_MOCK) return getMockSchemaResult();

  const siteTypeLabel =
    siteType === "ecommerce" ? "Интернет-магазин" :
    siteType === "local"     ? "Локальный бизнес / сервисная компания" :
                               "Информационный / контентный сайт";

  const blocksInfo = detectedBlocks.length > 0
    ? `Обнаруженные блоки на странице: ${detectedBlocks.join(", ")}`
    : "Блоки не определены";

  const existingInfo = existingSchemas.length > 0
    ? `Уже есть schema.org: ${existingSchemas.join(", ")} — не дублируй их.`
    : "Schema.org на странице отсутствует.";

  const prompt = `Ты — технический SEO-специалист. Сгенерируй валидные schema.org JSON-LD разметки для страницы.

URL: ${url}
Тип сайта: ${siteTypeLabel}
Основной ключ: ${brief.targetKeyword}
Title: ${brief.recommendedTitle}
${blocksInfo}
${existingInfo}

Подбери 2–3 типа schema.org с наибольшим SEO-эффектом для этого сайта.
Заполни реальными данными на основе URL и типа бизнеса. Если данных нет — используй плейсхолдеры [ЗАПОЛНИТЬ: описание].

Отвечай ТОЛЬКО JSON без markdown-обёртки:
{
  "schemas": [
    {
      "type": "Тип схемы",
      "description": "Зачем эта схема и что даёт в выдаче (1 предложение)",
      "code": "...валидный JSON-LD как строка..."
    }
  ]
}`;

  try {
    const ai = getClient();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const text = result.text ?? "";
    return JSON.parse(stripJsonFences(text)) as SchemaResult;
  } catch (err) {
    console.error("Gemini schema error:", err instanceof Error ? err.message : err);
    return getMockSchemaResult();
  }
}

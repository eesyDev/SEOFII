import { prisma } from "./prisma";

// ─────────────────────────────────────────
// PAGE TYPE
// ─────────────────────────────────────────

export type PageType = "home" | "service" | "portfolio" | "price" | "article" | "other";

export function detectPageType(url: string): PageType {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path === "/" || path === "" || path === "/index" || path === "/index.html") return "home";
    if (/\/(uslugi|services?|service|услуг)/.test(path)) return "service";
    if (/\/(portfolio|projects?|raboty|work|галере|портфол)/.test(path)) return "portfolio";
    if (/\/(price|prices|ceny|stoimost|прайс|цен|стоимост)/.test(path)) return "price";
    if (/\/(blog|article|articles|stati|news|post)/.test(path)) return "article";
    return "other";
  } catch {
    return "home";
  }
}

// Какие паттерны релевантны для каждого типа страницы
const PAGE_TYPE_PATTERNS: Record<PageType, string[]> = {
  home:      ["calculator", "team_profiles", "trust_badges", "reviews_testimonials", "portfolio_gallery", "cta_form", "social_proof_counter", "faq_section", "video_block"],
  service:   ["price_table", "faq_section", "cta_form", "trust_badges", "portfolio_gallery", "comparison_table", "calculator", "reviews_testimonials"],
  portfolio: ["portfolio_gallery", "reviews_testimonials", "social_proof_counter", "cta_form", "trust_badges"],
  price:     ["price_table", "calculator", "comparison_table", "cta_form", "faq_section", "trust_badges"],
  article:   ["faq_section", "lead_magnet", "cta_form", "reviews_testimonials"],
  other:     ["calculator", "portfolio_gallery", "reviews_testimonials", "price_table", "cta_form", "trust_badges", "team_profiles", "faq_section"],
};

export interface PatternInsight {
  pattern: string;     // machine ID: "cost_calculator"
  label: string;       // "Калькулятор стоимости"
  frequency: number;   // 0.7 → у 70% конкурентов есть
  patternType: string; // "conversion" | "trust" | "content" | "technical" | "navigation"
  rationale: string;
  present: boolean;    // есть ли уже на странице
}

// Извлекаем label из поля context = "Калькулятор стоимости: описание..."
function extractLabel(context: string | null, pattern: string): string {
  if (!context) return pattern;
  const colonIdx = context.indexOf(":");
  return colonIdx > 0 ? context.slice(0, colonIdx).trim() : pattern;
}

function extractRationale(context: string | null): string {
  if (!context) return "";
  const colonIdx = context.indexOf(":");
  return colonIdx > 0 ? context.slice(colonIdx + 1).trim() : context;
}

// Маппинг scraper-эвристик → человеческие слова для isPresent
const BLOCK_SYNONYMS: Record<string, string[]> = {
  reviews: ["отзыв", "рейтинг", "testimonial"],
  faq: ["faq", "вопрос", "ответ", "аккордеон"],
  video: ["видео", "youtube", "vimeo"],
  price: ["цена", "стоимость", "прайс", "тариф"],
  comparison_table: ["сравнен", "таблиц", "характеристик"],
  gallery: ["галерея", "портфолио", "работы", "проекты", "фото"],
  social_proof: ["клиент", "заказ", "пользовател", "цифр", "счётчик"],
  calculator: ["калькулятор", "расчёт", "смета", "конфигур"],
  map: ["карта", "адрес", "местоположение"],
  form: ["форма", "заявка", "обратная связь", "контакт"],
  chat: ["чат", "консультант", "jivo"],
  team: ["команда", "специалист", "мастер", "персонал", "бригада", "staff"],
};

function isPresent(
  label: string,
  pattern: string,
  existingBlocks: string[],
  detectedBlocks: string[] = []
): boolean {
  const normalize = (s: string) => s.toLowerCase()
    .replace(/[_\-\/]/g, " ")
    .replace(/ё/g, "е");

  const targets = [normalize(label), normalize(pattern)];
  const blocks = existingBlocks.map(normalize);

  // Проверяем AI-блоки
  const aiMatch = targets.some((target) =>
    blocks.some((block) => {
      const targetWords = target.split(/\s+/).filter((w) => w.length > 3);
      return targetWords.some((word) => block.includes(word));
    })
  );
  if (aiMatch) return true;

  // Проверяем scraper-эвристики через синонимы
  const normalizedLabel = normalize(label);
  const normalizedPattern = normalize(pattern);
  for (const [blockId, synonyms] of Object.entries(BLOCK_SYNONYMS)) {
    if (!detectedBlocks.includes(blockId)) continue;
    for (const syn of synonyms) {
      if (normalizedLabel.includes(syn) || normalizedPattern.includes(syn)) {
        return true;
      }
    }
  }

  return false;
}

export async function getPatternInsights(
  existingBlocks: string[],
  siteType: string,
  targetKeyword?: string,
  detectedBlocks: string[] = [],
  pageType: PageType = "home"
): Promise<PatternInsight[]> {
  // Приоритетные типы паттернов для каждого типа сайта
  const priorityTypes =
    siteType === "ecommerce"
      ? ["conversion", "trust", "content", "technical", "navigation"]
      : siteType === "local"
      ? ["trust", "conversion", "content", "technical", "navigation"]
      : ["content", "trust", "conversion", "technical", "navigation"];

  // Определяем нишу по ключевому слову (простая эвристика)
  const keyword = (targetKeyword ?? "").toLowerCase();
  const nicheMap: Record<string, string[]> = {
    construction_repair: ["ремонт", "отделка", "строительство"],
    dental: ["стоматолог", "зуб", "имплант", "винир"],
    lawyers: ["юрист", "адвокат", "развод", "наследство"],
    auto_service: ["автосервис", "ремонт двигателя", "шиномонтаж", "диагностика"],
  };

  let detectedNiche: string | undefined;
  for (const [niche, words] of Object.entries(nicheMap)) {
    if (words.some((w) => keyword.includes(w))) {
      detectedNiche = niche;
      break;
    }
  }

  // Запрашиваем по niche + pageType, с fallback на home если нет данных для типа
  const buildWhere = (pt: string) => ({
    confidence: "approved",
    pageType: pt,
    ...(detectedNiche ? { niche: detectedNiche } : {}),
  });

  let dbPatterns = await prisma.nichePattern.findMany({
    where: buildWhere(pageType),
    orderBy: [{ frequency: "desc" }],
    take: 50,
  });

  // Fallback: если для этого pageType нет паттернов — берём home
  if (dbPatterns.length === 0 && pageType !== "home") {
    dbPatterns = await prisma.nichePattern.findMany({
      where: buildWhere("home"),
      orderBy: [{ frequency: "desc" }],
      take: 50,
    });
  }

  if (dbPatterns.length === 0) return [];

  // Шаг 1: дедупликация по machine ID
  const seenById = new Map<string, (typeof dbPatterns)[number]>();
  for (const p of dbPatterns) {
    const existing = seenById.get(p.pattern);
    if (!existing || p.frequency > existing.frequency) {
      seenById.set(p.pattern, p);
    }
  }

  // Шаг 2: дедупликация по первым 2 значимым словам label
  const STOP = new Set(["и", "или", "для", "с", "в", "на", "по", "к", "из", "у", "о", "об", "а", "но", "их", "со"]);
  const labelKey = (label: string) =>
    label.toLowerCase()
      .replace(/[^а-яёa-z0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
      .slice(0, 2)
      .join(" ");

  const seenByLabel = new Map<string, (typeof dbPatterns)[number]>();
  for (const p of seenById.values()) {
    const label = extractLabel(p.context, p.pattern);
    const key = labelKey(label);
    const existing = seenByLabel.get(key);
    if (!existing || p.frequency > existing.frequency) {
      seenByLabel.set(key, p);
    }
  }
  const uniquePatterns = Array.from(seenByLabel.values());

  const insights: PatternInsight[] = uniquePatterns.map((p) => {
    const label = extractLabel(p.context, p.pattern);
    const rationale = extractRationale(p.context);
    const present = isPresent(label, p.pattern, existingBlocks, detectedBlocks);
    return {
      pattern: p.pattern,
      label,
      frequency: p.frequency,
      patternType: p.patternType,
      rationale,
      present,
    };
  });

  // Сортируем: сначала по приоритету типа, потом по частоте, missing выше present
  insights.sort((a, b) => {
    const aPriority = priorityTypes.indexOf(a.patternType);
    const bPriority = priorityTypes.indexOf(b.patternType);
    if (a.present !== b.present) return a.present ? 1 : -1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return b.frequency - a.frequency;
  });

  return insights.slice(0, 15);
}

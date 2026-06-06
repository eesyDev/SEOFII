import { prisma } from "./prisma";

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

// Проверяем присутствует ли паттерн среди существующих блоков
// Сравниваем label/pattern с existingBlocks через простой нормализованный contains
function isPresent(label: string, pattern: string, existingBlocks: string[]): boolean {
  const normalize = (s: string) => s.toLowerCase()
    .replace(/[_\-\/]/g, " ")
    .replace(/ё/g, "е");

  const targets = [normalize(label), normalize(pattern)];
  const blocks = existingBlocks.map(normalize);

  return targets.some((target) =>
    blocks.some((block) => {
      const targetWords = target.split(/\s+/).filter((w) => w.length > 3);
      return targetWords.some((word) => block.includes(word));
    })
  );
}

export async function getPatternInsights(
  existingBlocks: string[],
  siteType: string,
  targetKeyword?: string
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

  // Если ниша не определена — берём все (fallback)
  const dbPatterns = await prisma.nichePattern.findMany({
    where: {
      confidence: "approved",
      ...(detectedNiche ? { niche: detectedNiche } : {}),
    },
    orderBy: [{ frequency: "desc" }],
    take: 50,
  });

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
    const present = isPresent(label, p.pattern, existingBlocks);
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

  return insights.slice(0, 15); // макс 15 паттернов
}

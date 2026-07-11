// Дедупликация рекомендаций между секциями отчёта.
// quickFixes — канонический список задач; повторы в comparisons помечаем,
// чтобы UI показывал улику (finding), но не пересказывал ту же рекомендацию.

import type { CompetitorComparison, QuickFix } from "./claude";

const STOP = new Set([
  "и", "в", "на", "с", "по", "для", "из", "к", "от", "до", "не", "что", "это",
  "как", "или", "у", "же", "за", "то", "а", "но", "вы", "ваш", "ваша", "ваше",
  "добавьте", "создайте", "сделайте", "напишите", "укажите", "замените", "обновите",
  "раздел", "разделом", "блок", "страницы", "страницу", "сайт", "сайта", "слов",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
      .map((w) => w.slice(0, 6)) // грубый стемминг: "сертификаты"/"сертификатов" → "сертиф"
  );
}

function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size);
}

// ─────────────────────────────────────────
// Тематическая дедупликация между секциями отчёта.
// Один отчёт советовал FAQ в 4 секциях, отзывы в 3 — читается как вода.
// quickFixes и blockMatrix — канонические источники; из текстовых рекомендаций
// брифа и E-E-A-T убираем те, чьи темы уже полностью покрыты.
// ─────────────────────────────────────────

const TOPIC_PATTERNS: Record<string, RegExp> = {
  title: /\btitle\b|тайтл/i,
  h1: /\bh1\b/i,
  meta: /meta[- ]?description|мета-?описани/i,
  faq: /\bfaq\b|часто (задаваем|спрашива)|вопрос(ы|ов|ами)/i,
  reviews: /отзыв/i,
  // \b не работает с кириллицей — границы слова вручную
  map: /яндекс[.\s-]?карт|google maps|(?:^|[^а-яё])карт[ауые](?![а-яё])/i,
  schema: /schema|json-?ld|микроразметк/i,
  company: /о компании|статистик|объектов сдано|лет на рынке/i,
  portfolio: /портфолио|галере|фото (работ|объект)|до.?и.?после|до\/после|примеры работ/i,
  chat: /онлайн-?чат|мессенджер|whatsapp|telegram/i,
  certificates: /сертифика|лицензи/i,
  video: /видео/i,
  calculator: /калькулятор/i,
  team: /команд[аыу]|наши мастера|специалист/i,
  nap: /\bnap\b|адрес и телефон|в подвал/i,
  hours: /часы работы|график работы/i,
};

function topicsOf(text: string): string[] {
  return Object.entries(TOPIC_PATTERNS)
    .filter(([, re]) => re.test(text))
    .map(([topic]) => topic);
}

// Убирает из items те, чьи темы ПОЛНОСТЬЮ покрыты каноническими текстами.
// Рекомендация без распознанной темы или с хотя бы одной непокрытой — остаётся.
export function filterCoveredTexts(items: string[], canonicalTexts: string[]): string[] {
  const covered = new Set(canonicalTexts.flatMap(topicsOf));
  return items.filter((item) => {
    const topics = topicsOf(item);
    if (topics.length === 0) return true;
    return !topics.every((t) => covered.has(t));
  });
}

// Помечает в comparisons рекомендации, уже покрытые quickFixes
export function markCoveredRecommendations(
  comparisons: CompetitorComparison[],
  quickFixes: QuickFix[]
): CompetitorComparison[] {
  const fixTexts = quickFixes.map((f) => `${f.action} ${f.why}`);

  return comparisons.map((c) => ({
    ...c,
    reasons: c.reasons.map((r) => {
      const covered = fixTexts.some(
        (fix) => similarity(r.recommendation, fix) >= 0.35
      );
      return covered ? { ...r, coveredByQuickFix: true } : r;
    }),
  }));
}

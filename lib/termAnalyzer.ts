/**
 * TF-IDF анализ терминов: находит слова которые часто встречаются у конкурентов
 * но отсутствуют или редки на целевой странице.
 */
import * as cheerio from "cheerio";
import type { PageSnapshot } from "./scraper";

export interface MissingTerm {
  term: string;
  competitorFreq: number;   // среднее кол-во вхождений на страницу конкурента
  competitorCount: number;  // у скольких конкурентов встречается
  targetFreq: number;       // кол-во вхождений на целевой странице
}

export interface CompetitorExcerpt {
  domain: string;
  position: number;
  text: string; // 200–300 символов основного текста
}

// ─────────────────────────────────────────
// Стоп-слова (русский + общие)
// ─────────────────────────────────────────

const STOP_WORDS = new Set([
  // предлоги, союзы, частицы
  "и","в","не","на","что","он","она","они","это","то","есть","как","но","из",
  "у","с","по","за","к","а","же","так","если","или","ли","бы","до","при","от",
  "об","со","без","над","под","про","через","между","после","перед","для","чем",
  "уже","ещё","еще","даже","тоже","также","только","всего","всё","все","был",
  "была","были","быть","будет","будут","быть","нет","нас","вас","мне","тем",
  "том","так","там","тут","здесь","когда","где","кто","чего","него","неё",
  "ней","них","ним","нем","ней","хотя","потому","поэтому","потом","затем",
  "чтобы","хоть","пусть","ведь","вот","вот","нам","вам","его","её","их",
  // глаголы
  "может","можно","нужно","надо","должен","должна","хочет","хотим","знает",
  "делает","сделать","делать","получить","иметь","быть","стать","сможет",
  "поможет","помочь","работает","работать","позволит","позволяет",
  // числительные и общие
  "один","два","три","четыре","пять","лет","год","года","раз","более","менее",
  "много","мало","очень","самый","самая","самые","наш","наша","наши","ваш",
  "ваша","ваши","свой","своя","свои","такой","такая","такие","этот","эта",
  "этой","этих","этим","новый","новая","новые","который","которая","которые",
  "каждый","каждая","любой","любая","всегда","никогда","сразу","теперь",
]);

// ─────────────────────────────────────────
// Утилиты
// ─────────────────────────────────────────

function stripHtml(rawHtml: string): string {
  const $ = cheerio.load(rawHtml);
  return $("body").text().replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^а-яёa-z\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

function buildFreqMap(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return freq;
}

// ─────────────────────────────────────────
// Основной анализ
// ─────────────────────────────────────────

/**
 * Возвращает топ-N терминов частых у конкурентов, но отсутствующих у клиента.
 */
export function analyzeMissingTerms(
  target: PageSnapshot,
  competitors: PageSnapshot[],
  topN = 20
): MissingTerm[] {
  const validComps = competitors.filter((c) => !c.fetchError && c.rawHtml);
  if (validComps.length === 0 || !target.rawHtml) return [];

  const targetText = stripHtml(target.rawHtml);
  const targetFreq = buildFreqMap(tokenize(targetText));

  // Агрегируем данные по конкурентам
  const compData = new Map<string, { totalFreq: number; pagesCount: number }>();

  for (const comp of validComps) {
    const tokens = tokenize(stripHtml(comp.rawHtml!));
    const freq = buildFreqMap(tokens);
    const seen = new Set<string>();

    for (const [term, count] of freq.entries()) {
      if (count < 2 || seen.has(term)) continue; // меньше 2 вхождений — шум
      seen.add(term);
      const existing = compData.get(term) ?? { totalFreq: 0, pagesCount: 0 };
      compData.set(term, {
        totalFreq: existing.totalFreq + count,
        pagesCount: existing.pagesCount + 1,
      });
    }
  }

  const total = validComps.length;
  const results: MissingTerm[] = [];

  for (const [term, { totalFreq, pagesCount }] of compData.entries()) {
    const coverageRatio = pagesCount / total;
    if (coverageRatio < 0.4) continue; // должен быть у 40%+ конкурентов

    const avgFreq = totalFreq / pagesCount;
    if (avgFreq < 2 || avgFreq > 20) continue; // диапазон значимых слов

    const targetCount = targetFreq.get(term) ?? 0;
    if (targetCount >= avgFreq * 0.5) continue; // у клиента уже достаточно этого слова

    results.push({
      term,
      competitorFreq: Math.round(avgFreq * 10) / 10,
      competitorCount: pagesCount,
      targetFreq: targetCount,
    });
  }

  return results
    .sort((a, b) => b.competitorCount - a.competitorCount || b.competitorFreq - a.competitorFreq)
    .slice(0, topN);
}

// ─────────────────────────────────────────
// Извлечение содержательных цитат
// ─────────────────────────────────────────

/**
 * Берёт самый длинный абзац со страницы конкурента — наиболее вероятно
 * это описание услуги, а не навигация.
 */
export function extractExcerpt(rawHtml: string | undefined, maxChars = 280): string {
  if (!rawHtml) return "";
  const $ = cheerio.load(rawHtml);
  let best = "";
  $("p").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > best.length && text.length > 60) best = text;
  });
  // Fallback: простой текст из body если параграфов нет
  if (!best) {
    best = $("body").text().replace(/\s+/g, " ").trim();
  }
  return best.slice(0, maxChars).trim();
}

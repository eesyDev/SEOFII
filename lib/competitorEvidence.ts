// Дословные улики с страниц конкурентов — без AI, чистое извлечение.
// Показываем пользователю ЧТО ИМЕННО есть у конкурентов: их FAQ-вопросы,
// их цены, их структура заголовков. Факты вместо пересказа.

import type { PageSnapshot } from "./scraper";
import type { SerpResult } from "./dataforseo";
import { htmlToText } from "./factGuard";

export interface CompetitorEvidence {
  domain: string;
  url: string;
  position: number;
  title: string;
  h1: string;
  wordCount: number;
  headings: string[];       // полный список H2/H3
  detectedBlocks: string[];
  schemaTypes: string[];
  faqQuestions: string[];   // дословные вопросы из их заголовков
  priceMentions: string[];  // дословные упоминания цен из их текста
}

const QUESTION_START = /^(сколько|как|что|какой|какая|какие|почему|можно ли|нужно ли|где|когда|чем|стоит ли|входит ли|даёте ли|есть ли|do |how |what |why |when |where |can |is |are )/i;

function extractFaqQuestions(headings: string[]): string[] {
  return headings
    .filter((h) => h.includes("?") || QUESTION_START.test(h.trim()))
    .slice(0, 6);
}

function extractPriceMentions(text: string): string[] {
  const found: string[] = [];
  const re = /[^.!?]{0,60}?(?:от\s+)?\d[\d\s]{2,}\s*(?:₽|руб(?:лей|ля|\.)?|\$|€)(?:\s*\/?\s*(?:м²|кв\.?\s?м|мес|шт))?[^.!?]{0,30}/gi;
  for (const m of text.matchAll(re)) {
    const cleaned = m[0].replace(/\s+/g, " ").trim();
    if (cleaned.length > 8 && found.length < 4) found.push(cleaned);
  }
  return found;
}

export function buildCompetitorEvidence(
  compSnapshots: PageSnapshot[],
  competitors: SerpResult[]
): CompetitorEvidence[] {
  return compSnapshots
    .map((snap, i) => {
      const comp = competitors[i];
      if (!comp || snap.fetchError) return null;

      const text = snap.rawHtml ? htmlToText(snap.rawHtml) : "";

      return {
        domain: comp.domain || (() => { try { return new URL(snap.url).hostname; } catch { return snap.url; } })(),
        url: snap.url,
        position: comp.position,
        title: snap.title,
        h1: snap.h1,
        wordCount: snap.wordCount,
        headings: snap.headings,
        detectedBlocks: snap.detectedBlocks,
        schemaTypes: snap.schemaTypes,
        faqQuestions: extractFaqQuestions(snap.headings),
        priceMentions: extractPriceMentions(text),
      };
    })
    .filter((e): e is CompetitorEvidence => e !== null);
}

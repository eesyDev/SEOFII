import type { SerpResult, KeywordData, DomainInfo } from "./dataforseo";
import type { GscRow } from "./gsc";

// ─────────────────────────────────────────
// ТИПЫ
// ─────────────────────────────────────────

export interface EnrichedKeyword extends KeywordData {
  occurrences: number; // сколько конкурентов упоминают ключ в title/url
  tag: "top3" | "quick-win" | "owned" | "gap";
  gscPosition?: number;
  gscClicks?: number;
  gscImpressions?: number;
  gscCtr?: number;
}

export interface KeywordCluster {
  topic: string;
  keywords: string[];
  totalVolume: number;
  intent: "informational" | "commercial" | "transactional" | "navigational";
}

export interface AnalyticsSummary {
  totalGapKeywords: number;
  quickWinsCount: number;
  avgCompetitorDomainAgeMonths: number | null;
  trafficPotential: number; // сумма volume по топ-20 gap-ключам
  gscTotalQueries: number;
  gscTotalClicks: number;
  gscTotalImpressions: number;
}

export interface AnalyticsResult {
  summary: AnalyticsSummary;
  gapKeywords: EnrichedKeyword[];
  quickWins: GscRow[];
  allKeywords: EnrichedKeyword[];
  clusters: KeywordCluster[];
}

// ─────────────────────────────────────────
// ВНУТРЕННИЕ УТИЛИТЫ
// ─────────────────────────────────────────

const STOP_WORDS = new Set([
  "how", "to", "the", "a", "an", "and", "or", "for", "in", "of", "with",
  "is", "are", "be", "do", "does", "did", "will", "would", "can", "could",
  "on", "at", "by", "from", "as", "it", "its", "this", "that", "what",
  "which", "who", "when", "where", "why", "vs", "top", "best", "get",
  "use", "using", "your", "my", "our", "their", "there", "here", "not",
  "no", "all", "more", "most", "some", "any", "every", "each", "about",
]);

function countOccurrences(keyword: string, competitors: SerpResult[]): number {
  const kLower = keyword.toLowerCase();
  const kSlug = kLower.replace(/\s+/g, "-");
  return competitors.filter(
    (c) =>
      c.title.toLowerCase().includes(kLower) ||
      c.url.toLowerCase().includes(kSlug)
  ).length;
}

function tagKeyword(keyword: string, gscMap: Map<string, GscRow>): EnrichedKeyword["tag"] {
  const row = gscMap.get(keyword.toLowerCase());
  if (!row) return "gap";
  if (row.position <= 4) return "top3";
  if (row.position <= 20) return "quick-win";
  return "owned";
}

function avgDomainAgeMonths(domainInfo: DomainInfo[]): number | null {
  const dated = domainInfo.filter((d) => d.registeredAt);
  if (dated.length === 0) return null;
  const now = Date.now();
  const total = dated.reduce((sum, d) => {
    const ms = now - new Date(d.registeredAt!).getTime();
    return sum + ms / (1000 * 60 * 60 * 24 * 30);
  }, 0);
  return Math.round(total / dated.length);
}

function guessIntent(word: string): KeywordCluster["intent"] {
  if (/buy|price|cost|cheap|order|shop|sale|купить|цена|стоим/.test(word))
    return "transactional";
  if (/best|review|compare|vs|лучш|рейтинг|сравн/.test(word))
    return "commercial";
  if (/login|sign|account|download|app|войти|скачать/.test(word))
    return "navigational";
  return "informational";
}

function buildClusters(keywords: EnrichedKeyword[]): KeywordCluster[] {
  if (keywords.length === 0) return [];

  // Частота значимых слов по всем ключам
  const wordFreq = new Map<string, number>();
  for (const k of keywords) {
    for (const word of k.keyword.toLowerCase().split(/\s+/)) {
      if (!STOP_WORDS.has(word) && word.length > 2) {
        wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
      }
    }
  }

  const topics = [...wordFreq.entries()]
    .filter(([, freq]) => freq >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 8);

  const assigned = new Set<string>();
  const clusters: KeywordCluster[] = [];

  for (const topic of topics) {
    const matching = keywords.filter(
      (k) => !assigned.has(k.keyword) && k.keyword.toLowerCase().includes(topic)
    );
    if (matching.length < 2) continue;
    matching.forEach((k) => assigned.add(k.keyword));
    clusters.push({
      topic,
      keywords: matching.map((k) => k.keyword),
      totalVolume: matching.reduce((s, k) => s + k.volume, 0),
      intent: guessIntent(topic),
    });
  }

  // Оставшиеся ключи — в кластер «другие»
  const rest = keywords.filter((k) => !assigned.has(k.keyword));
  if (rest.length > 0) {
    clusters.push({
      topic: "другие",
      keywords: rest.map((k) => k.keyword),
      totalVolume: rest.reduce((s, k) => s + k.volume, 0),
      intent: "informational",
    });
  }

  return clusters.sort((a, b) => b.totalVolume - a.totalVolume);
}

// ─────────────────────────────────────────
// ОСНОВНАЯ ФУНКЦИЯ
// ─────────────────────────────────────────

export function computeAnalytics(
  competitors: SerpResult[],
  keywordData: KeywordData[],
  domainInfo: DomainInfo[],
  gscRows: GscRow[]
): AnalyticsResult {
  const gscMap = new Map<string, GscRow>(
    gscRows.map((r) => [r.query.toLowerCase(), r])
  );

  // Обогащаем все ключи
  const allKeywords: EnrichedKeyword[] = keywordData
    .map((k) => {
      const gsc = gscMap.get(k.keyword.toLowerCase());
      return {
        ...k,
        occurrences: countOccurrences(k.keyword, competitors),
        tag: tagKeyword(k.keyword, gscMap),
        ...(gsc && {
          gscPosition: gsc.position,
          gscClicks: gsc.clicks,
          gscImpressions: gsc.impressions,
          gscCtr: gsc.ctr,
        }),
      };
    })
    .sort((a, b) => b.volume - a.volume);

  const gapKeywords = allKeywords.filter((k) => k.tag === "gap");

  const quickWins = gscRows
    .filter((r) => r.position >= 5 && r.position <= 20)
    .sort((a, b) => b.impressions - a.impressions);

  const clusters = buildClusters(allKeywords);

  const summary: AnalyticsSummary = {
    totalGapKeywords: gapKeywords.length,
    quickWinsCount: quickWins.length,
    avgCompetitorDomainAgeMonths: avgDomainAgeMonths(domainInfo),
    trafficPotential: gapKeywords.slice(0, 20).reduce((s, k) => s + k.volume, 0),
    gscTotalQueries: gscRows.length,
    gscTotalClicks: gscRows.reduce((s, r) => s + r.clicks, 0),
    gscTotalImpressions: gscRows.reduce((s, r) => s + r.impressions, 0),
  };

  return { summary, gapKeywords, quickWins, allKeywords, clusters };
}

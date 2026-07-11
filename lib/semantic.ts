// Семантический анализ на эмбеддингах (Gemini text-embedding-004):
// 1) скор релевантности страницы запросу vs топ-конкуренты
// 2) смысловая кластеризация GSC-запросов (спрос по темам)
// 3) семантические пробелы: темы разделов конкурентов, которых нет у нас

import type { GscRow } from "./gsc";

const EMBED_MODEL = "gemini-embedding-2";
// Квота Gemini — токены/минуту: батч 100 текстов с полными страницами ловит 429.
// Поэтому батчи по 50, страницы режем до 6000 символов, на 429 — пауза и ретрай.
const BATCH_SIZE = 50;
const PAGE_TEXT_LIMIT = 6000;
const RETRY_DELAYS_MS = [15_000, 45_000];


// ─────────────────────────────────────────
// ТИПЫ
// ─────────────────────────────────────────

export interface SemanticRelevance {
  pageScore: number;   // 0–100: наша страница vs целевой запрос
  top3Avg: number;     // 0–100: средний скор конкурентов vs тот же запрос
  perCompetitor: Array<{ domain: string; position: number; score: number }>;
}

export interface QueryCluster {
  label: string;            // самый частотный запрос кластера
  queries: string[];
  totalImpressions: number;
  totalClicks: number;
  avgPosition: number;
  pageRelevance: number;    // 0–100: насколько страница отвечает этой теме
}

export interface SemanticGap {
  theme: string;            // заголовок раздела конкурента
  competitors: string[];    // у кого есть
  closestOwn: string | null; // наш самый близкий заголовок
  similarity: number;       // 0–100 к нашему ближайшему
}

export interface SemanticAnalysis {
  relevance: SemanticRelevance | null;
  queryClusters: QueryCluster[];
  semanticGaps: SemanticGap[];
}

// ─────────────────────────────────────────
// ЭМБЕДДИНГИ + КОСИНУС
// ─────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function embedBatch(texts: string[], key: string): Promise<number[][]> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${EMBED_MODEL}`,
            content: { parts: [{ text }] },
          })),
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      return (data.embeddings ?? []).map((e: { values?: number[] }) => e.values ?? []);
    }
    if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw new Error(`Embeddings API ${res.status}: ${await res.text()}`);
  }
}

// SDK @google/genai для gemini-embedding-2 не батчит contents — используем REST batchEmbedContents
async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = process.env.GEMINI_API_KEY!;
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 8000) || " ");
    out.push(...(await embedBatch(batch, key)));
  }

  if (out.length !== texts.length) {
    throw new Error(`Embeddings count mismatch: ${out.length} != ${texts.length}`);
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function centroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const c = new Array<number>(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) c[i] += v[i];
  return c.map((x) => x / vectors.length);
}

const pct = (cos: number) => Math.round(Math.max(0, Math.min(1, cos)) * 100);

// ─────────────────────────────────────────
// ОСНОВНОЙ АНАЛИЗ
// ─────────────────────────────────────────

export interface SemanticInput {
  targetKeyword: string;
  targetPageText: string;
  targetHeadings: string[];
  competitors: Array<{
    domain: string;
    position: number;
    pageText: string;
    headings: string[];
  }>;
  gscRows: GscRow[];
}

export async function computeSemanticAnalysis(input: SemanticInput): Promise<SemanticAnalysis | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const comps = input.competitors
    .filter((c) => c.pageText.length > 100)
    .map((c) => ({ ...c, pageText: c.pageText.slice(0, PAGE_TEXT_LIMIT) }));
  const targetPageText = input.targetPageText.slice(0, PAGE_TEXT_LIMIT);

  // Топ GSC-запросов по показам (без URL-строк — фильтруются раньше)
  const topQueries = [...input.gscRows]
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 100);

  // Собираем ВСЕ тексты в один батч-запрос: [запрос, наша страница, конкуренты, наши H2, H2 конкурентов, GSC-запросы]
  const compHeadingItems = comps.flatMap((c) =>
    c.headings.map((h) => ({ domain: c.domain, heading: h }))
  );

  const texts: string[] = [
    input.targetKeyword,
    targetPageText,
    ...comps.map((c) => c.pageText),
    ...input.targetHeadings,
    ...compHeadingItems.map((h) => h.heading),
    ...topQueries.map((q) => q.query),
  ];

  const vectors = await embedTexts(texts);

  let idx = 0;
  const vKeyword = vectors[idx++];
  const vPage = vectors[idx++];
  const vComps = comps.map(() => vectors[idx++]);
  const vOwnHeadings = input.targetHeadings.map(() => vectors[idx++]);
  const vCompHeadings = compHeadingItems.map(() => vectors[idx++]);
  const vQueries = topQueries.map(() => vectors[idx++]);

  // ── 1. Релевантность запросу ──
  let relevance: SemanticRelevance | null = null;
  if (input.targetKeyword && input.targetPageText.length > 100) {
    const perCompetitor = comps.map((c, i) => ({
      domain: c.domain,
      position: c.position,
      score: pct(cosine(vComps[i], vKeyword)),
    }));
    const top3 = perCompetitor.slice(0, 3);
    relevance = {
      pageScore: pct(cosine(vPage, vKeyword)),
      top3Avg: top3.length > 0 ? Math.round(top3.reduce((s, c) => s + c.score, 0) / top3.length) : 0,
      perCompetitor,
    };
  }

  // ── 2. Кластеризация GSC-запросов (жадная, по близости к центроиду) ──
  // Калибровка под gemini-embedding-2: одна тема ≥0.89, разные темы одной ниши 0.73–0.87
  const CLUSTER_THRESHOLD = 0.88;
  interface RawCluster { indices: number[]; centroidVec: number[] }
  const rawClusters: RawCluster[] = [];

  topQueries.forEach((_, qi) => {
    let bestCluster: RawCluster | null = null;
    let bestSim = CLUSTER_THRESHOLD;
    for (const cl of rawClusters) {
      const sim = cosine(vQueries[qi], cl.centroidVec);
      if (sim >= bestSim) { bestSim = sim; bestCluster = cl; }
    }
    if (bestCluster) {
      bestCluster.indices.push(qi);
      bestCluster.centroidVec = centroid(bestCluster.indices.map((i) => vQueries[i]));
    } else {
      rawClusters.push({ indices: [qi], centroidVec: vQueries[qi] });
    }
  });

  const queryClusters: QueryCluster[] = rawClusters
    .filter((cl) => cl.indices.length >= 2)
    .map((cl) => {
      const rows = cl.indices.map((i) => topQueries[i]);
      const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
      return {
        label: rows.sort((a, b) => b.impressions - a.impressions)[0].query,
        queries: rows.map((r) => r.query).slice(0, 12),
        totalImpressions,
        totalClicks: rows.reduce((s, r) => s + r.clicks, 0),
        avgPosition: Math.round((rows.reduce((s, r) => s + r.position, 0) / rows.length) * 10) / 10,
        pageRelevance: pct(cosine(cl.centroidVec, vPage)),
      };
    })
    .sort((a, b) => b.totalImpressions - a.totalImpressions)
    .slice(0, 10);

  // ── 3. Семантические пробелы: разделы конкурентов без близкого аналога у нас ──
  const GAP_THRESHOLD = 0.75;    // ниже — «у нас такого раздела нет» (раскрытая тема даёт ≥0.8)
  const DEDUPE_THRESHOLD = 0.85; // похожие пробелы разных конкурентов склеиваем
  const TOPIC_RELEVANCE_MIN = 0.5; // заголовок должен быть про тему запроса, а не UI-шелуха

  // Служебные заголовки интерфейса, а не контентные разделы
  const UI_JUNK = /beta|похожие страницы|попробуйте|спроси|подписк|войти|личный кабинет|регистрац|cookie|политик|скачать приложение/i;

  const gapCandidates: Array<{ theme: string; domain: string; vec: number[]; closestOwn: string | null; sim: number }> = [];
  compHeadingItems.forEach((item, i) => {
    const h = item.heading.trim();
    if (h.length < 12 || h.split(/\s+/).length < 2) return; // «Цены», «FAQ» — слишком общие
    if (UI_JUNK.test(h)) return;
    if (/\d[\d\s]*\s*[₽$€]/.test(h)) return; // обрезки прайсов вместо заголовков
    // Каталожные счётчики («212 185 мастеров», «7370 компаний») — не контентные разделы; годы (2026) оставляем
    if (/\d{3}\s\d{3}|\b(?!20[0-3]\d\b)\d{4,}\b/.test(h)) return;
    if (cosine(vCompHeadings[i], vKeyword) < TOPIC_RELEVANCE_MIN) return; // не про тему страницы

    let maxSim = 0;
    let closest: string | null = null;
    vOwnHeadings.forEach((vh, hi) => {
      const s = cosine(vCompHeadings[i], vh);
      if (s > maxSim) { maxSim = s; closest = input.targetHeadings[hi]; }
    });
    if (maxSim < GAP_THRESHOLD) {
      gapCandidates.push({ theme: h, domain: item.domain, vec: vCompHeadings[i], closestOwn: closest, sim: maxSim });
    }
  });

  const semanticGaps: SemanticGap[] = [];
  for (const cand of gapCandidates) {
    const existing = semanticGaps.find((g) => {
      const gi = gapCandidates.find((c) => c.theme === g.theme);
      return gi && cosine(cand.vec, gi.vec) >= DEDUPE_THRESHOLD;
    });
    if (existing) {
      if (!existing.competitors.includes(cand.domain)) existing.competitors.push(cand.domain);
    } else {
      semanticGaps.push({
        theme: cand.theme,
        competitors: [cand.domain],
        closestOwn: cand.closestOwn,
        similarity: pct(cand.sim),
      });
    }
  }
  // Темы, которые есть у нескольких конкурентов — важнее
  semanticGaps.sort((a, b) => b.competitors.length - a.competitors.length || a.similarity - b.similarity);

  return { relevance, queryClusters, semanticGaps: semanticGaps.slice(0, 10) };
}

// Клиент для DataForSEO API
// Docs: https://docs.dataforseo.com/v3/serp/google/organic/

const BASE_URL = "https://api.dataforseo.com/v3";

// Базовые заголовки с Basic Auth (login:password → base64)
function getHeaders(): HeadersInit {
  const credentials = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString("base64");

  return {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
  };
}

// ─────────────────────────────────────────
// ТИПЫ
// ─────────────────────────────────────────

export interface SerpResult {
  domain: string;
  position: number;
  title: string;
  url: string;
}

export interface KeywordData {
  keyword: string;
  volume: number;
  cpc: number;
  competition: number;
}

// ─────────────────────────────────────────
// SERP: топ-10 конкурентов по URL
// ─────────────────────────────────────────

export async function fetchCompetitors(url: string): Promise<SerpResult[]> {
  // Вытаскиваем keyword из title/meta страницы — упрощённо берём домен+путь
  const targetUrl = new URL(url);
  const searchQuery = targetUrl.hostname + " " + targetUrl.pathname.replace(/\//g, " ").trim();

  const response = await fetch(`${BASE_URL}/serp/google/organic/live/advanced`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify([
      {
        keyword: searchQuery,
        location_code: 2840, // США по умолчанию, потом сделать настраиваемым
        language_code: "en",
        depth: 10,
      },
    ]),
  });

  if (!response.ok) {
    throw new Error(`DataForSEO SERP error: ${response.status}`);
  }

  const data = await response.json();
  const items = data?.tasks?.[0]?.result?.[0]?.items ?? [];

  return items
    .filter((item: any) => item.type === "organic")
    .slice(0, 10)
    .map((item: any, index: number) => ({
      domain: new URL(item.url).hostname,
      position: index + 1,
      title: item.title ?? "",
      url: item.url ?? "",
    }));
}

// ─────────────────────────────────────────
// KEYWORDS: данные по ключевым словам
// ─────────────────────────────────────────

export async function fetchKeywords(keywords: string[]): Promise<KeywordData[]> {
  if (keywords.length === 0) return [];

  const response = await fetch(`${BASE_URL}/keywords_data/google_ads/search_volume/live`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify([
      {
        keywords,
        location_code: 2840,
        language_code: "en",
      },
    ]),
  });

  if (!response.ok) {
    throw new Error(`DataForSEO Keywords error: ${response.status}`);
  }

  const data = await response.json();
  const items = data?.tasks?.[0]?.result ?? [];

  return items.map((item: any) => ({
    keyword: item.keyword ?? "",
    volume: item.search_volume ?? 0,
    cpc: item.cpc ?? 0,
    competition: item.competition ?? 0,
  }));
}

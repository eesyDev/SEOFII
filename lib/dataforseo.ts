// Клиент для DataForSEO API
// Docs: https://docs.dataforseo.com/v3/serp/google/organic/

const BASE_URL = "https://api.dataforseo.com/v3";

const USE_MOCK = !process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD;

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
  snippet: string;
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

const MOCK_SNIPPETS = [
  "Written by certified SEO expert John Smith with 10+ years of experience. Updated monthly with latest Google algorithm insights.",
  "Our editorial team reviews every piece. Sources cited from Google Search Central, Moz, and Ahrefs research studies.",
  "Award-winning digital marketing agency since 2008. Featured in Forbes, Search Engine Journal, and Wired.",
  "Independent research-backed guide. All recommendations tested on real client sites with documented case studies.",
  "Author: Dr. Sarah Chen, PhD in Information Retrieval. Peer-reviewed methodology, updated quarterly.",
  "Trusted by 50,000+ SEO professionals. Member of SEMPO, regularly cited in academic SEO research.",
  "No-fluff guide from practitioners. Real data from 200+ audited sites included. Last reviewed this month.",
  "Written by the team behind multiple top-10 ranking e-commerce sites. Transparent methodology disclosed.",
  "Endorsed by leading SEO tools. Our accuracy rating: 94% based on 1,200 user case study submissions.",
  "Comprehensive resource maintained by a team of 8 SEO specialists. All claims backed by Google documentation.",
];

function getMockCompetitors(url: string): SerpResult[] {
  const domain = new URL(url).hostname;
  return Array.from({ length: 10 }, (_, i) => ({
    domain: `competitor${i + 1}.com`,
    position: i + 1,
    title: `Best ${domain} Guide ${i + 1} — Complete Overview`,
    url: `https://competitor${i + 1}.com/guide`,
    snippet: MOCK_SNIPPETS[i] ?? "",
  }));
}

function getMockKeywords(keywords: string[]): KeywordData[] {
  return keywords.slice(0, 10).map((kw, i) => ({
    keyword: kw,
    volume: Math.floor(Math.random() * 5000) + 100,
    cpc: Math.round((Math.random() * 3 + 0.1) * 100) / 100,
    competition: Math.round(Math.random() * 100) / 100,
  }));
}

export async function fetchCompetitors(url: string): Promise<SerpResult[]> {
  if (USE_MOCK) return getMockCompetitors(url);

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
      snippet: item.description ?? "",
    }));
}

// ─────────────────────────────────────────
// KEYWORDS: данные по ключевым словам
// ─────────────────────────────────────────

export async function fetchKeywords(keywords: string[]): Promise<KeywordData[]> {
  if (keywords.length === 0) return [];
  if (USE_MOCK) return getMockKeywords(keywords);

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

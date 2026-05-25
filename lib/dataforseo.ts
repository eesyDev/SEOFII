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

export interface DomainInfo {
  domain: string;
  domainAge: string | null;       // "3 года 4 месяца" или null
  registeredAt: string | null;    // ISO date
  backlinks: number;
  referringDomains: number;
}

// ─────────────────────────────────────────
// LOCALES
// ─────────────────────────────────────────

export const LOCATIONS: Record<string, { code: number; label: string }> = {
  RU: { code: 2643, label: "Россия" },
  US: { code: 2840, label: "США" },
  UK: { code: 2826, label: "Великобритания" },
  DE: { code: 2276, label: "Германия" },
  FR: { code: 2250, label: "Франция" },
  KZ: { code: 2398, label: "Казахстан" },
  UA: { code: 2804, label: "Украина" },
  BY: { code: 2112, label: "Беларусь" },
};

const LOCATION_LANGUAGE: Record<number, string> = {
  2643: "ru", 2398: "ru", 2804: "ru", 2112: "ru",
  2840: "en", 2826: "en",
  2276: "de",
  2250: "fr",
};

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

export async function fetchCompetitors(url: string, locationCode = 2840, searchQuery?: string): Promise<SerpResult[]> {
  if (USE_MOCK) return getMockCompetitors(url);

  if (!searchQuery) {
    const targetUrl = new URL(url);
    searchQuery = targetUrl.hostname + " " + targetUrl.pathname.replace(/\//g, " ").trim();
  }

  // Язык определяем по локации
  const languageCode = LOCATION_LANGUAGE[locationCode] ?? "en";

  const response = await fetch(`${BASE_URL}/serp/google/organic/live/advanced`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify([
      {
        keyword: searchQuery,
        location_code: locationCode,
        language_code: languageCode,
        depth: 10,
      },
    ]),
  });

  if (!response.ok) {
    let detail = "";
    try { const body = await response.json(); detail = JSON.stringify(body).slice(0, 200); } catch {}
    throw new Error(`DataForSEO SERP error: ${response.status}${detail ? " — " + detail : ""}`);
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

// ─────────────────────────────────────────
// DOMAIN INFO: возраст домена + бэклинки
// ─────────────────────────────────────────

function formatDomainAge(registeredAt: string | null): string | null {
  if (!registeredAt) return null;
  const created = new Date(registeredAt);
  if (isNaN(created.getTime())) return null;
  const now = new Date();
  const years = now.getFullYear() - created.getFullYear();
  const months = now.getMonth() - created.getMonth() + years * 12;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} мес.`;
  if (m === 0) return `${y} ${y === 1 ? "год" : y < 5 ? "года" : "лет"}`;
  return `${y} ${y === 1 ? "год" : y < 5 ? "года" : "лет"} ${m} мес.`;
}

function getMockDomainInfo(domains: string[]): DomainInfo[] {
  return domains.map((domain, i) => {
    const yearsAgo = 2 + (i % 8);
    const registered = new Date();
    registered.setFullYear(registered.getFullYear() - yearsAgo);
    const registeredAt = registered.toISOString();
    return {
      domain,
      domainAge: formatDomainAge(registeredAt),
      registeredAt,
      backlinks: Math.floor(Math.random() * 50_000) + 1_000,
      referringDomains: Math.floor(Math.random() * 2_000) + 50,
    };
  });
}

export async function fetchDomainInfo(domains: string[]): Promise<DomainInfo[]> {
  if (domains.length === 0) return [];
  if (USE_MOCK) return getMockDomainInfo(domains);

  // Параллельно: WHOIS (возраст) + Backlinks (ссылки)
  const [whoisRes, backlinksRes] = await Promise.all([
    fetch(`${BASE_URL}/domain_analytics/whois/overview/live`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(domains.map((d) => ({ domain: d }))),
    }),
    fetch(`${BASE_URL}/backlinks/summary/live`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(domains.map((d) => ({ target: d, target_type: "domain" }))),
    }),
  ]);

  const whoisData = whoisRes.ok ? await whoisRes.json() : null;
  const backlinksData = backlinksRes.ok ? await backlinksRes.json() : null;

  const whoisMap: Record<string, string | null> = {};
  for (const task of whoisData?.tasks ?? []) {
    for (const item of task?.result ?? []) {
      whoisMap[item.domain] = item.created_date ?? null;
    }
  }

  const backlinksMap: Record<string, { backlinks: number; referringDomains: number }> = {};
  for (const task of backlinksData?.tasks ?? []) {
    for (const item of task?.result ?? []) {
      backlinksMap[item.target] = {
        backlinks: item.backlinks ?? 0,
        referringDomains: item.referring_domains ?? 0,
      };
    }
  }

  return domains.map((domain) => {
    const registeredAt = whoisMap[domain] ?? null;
    const bl = backlinksMap[domain] ?? { backlinks: 0, referringDomains: 0 };
    return {
      domain,
      domainAge: formatDomainAge(registeredAt),
      registeredAt,
      backlinks: bl.backlinks,
      referringDomains: bl.referringDomains,
    };
  });
}

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

// Реальный ранжирующийся запрос домена из индекса Google (DataForSEO Labs).
// Форма совместима с GscRow — питает тот же анализ, когда GSC/CSV нет,
// и работает даже для сайтов за Cloudflare (страницу скрейпить не нужно).
export interface RankedKeyword {
  query: string;
  position: number;
  impressions: number; // здесь — месячный объём поиска (проксирует спрос)
  clicks: number;
  ctr: number;
  volume: number;
  cpc: number;
  url: string; // страница, которая ранжируется по этому запросу
}

// Запросы, по которым домен уже ранжируется в Google (топ-100).
// Требует подписки DataForSEO Labs; при отказе возвращает [].
export async function fetchRankedKeywords(
  domain: string,
  locationCode = 2840,
  limit = 700
): Promise<RankedKeyword[]> {
  if (USE_MOCK) return [];
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

  try {
    const res = await fetch(`${BASE_URL}/dataforseo_labs/google/ranked_keywords/live`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify([
        { target: cleanDomain, location_code: locationCode, language_code: "en", limit },
      ]),
    });
    const data = await res.json();
    const task = data.tasks?.[0];
    if (task?.status_code !== 20000) {
      console.warn(`[dataforseo] ranked_keywords unavailable: ${task?.status_message}`);
      return [];
    }
    const items = task.result?.[0]?.items ?? [];
    return items
      .map((it: Record<string, any>): RankedKeyword | null => {
        const kw = it.keyword_data?.keyword;
        const pos = it.ranked_serp_element?.serp_item?.rank_absolute;
        if (!kw || typeof pos !== "number") return null;
        const volume = it.keyword_data?.keyword_info?.search_volume ?? 0;
        return {
          query: kw,
          position: pos,
          impressions: volume,
          clicks: 0,
          ctr: 0,
          volume,
          cpc: it.keyword_data?.keyword_info?.cpc ?? 0,
          url: it.ranked_serp_element?.serp_item?.url ?? "",
        };
      })
      .filter((r: RankedKeyword | null): r is RankedKeyword => r !== null);
  } catch (err) {
    console.warn("[dataforseo] ranked_keywords error:", err);
    return [];
  }
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

// Домены-агрегаторы/медиа/соцсети — не являются реальными конкурентами в нише
export const AGGREGATOR_DOMAINS = new Set([
  // Соцсети
  "vk.com", "vkontakte.ru", "ok.ru", "instagram.com", "facebook.com",
  "twitter.com", "x.com", "youtube.com", "tiktok.com", "t.me", "telegram.org",
  "zen.yandex.ru", "dzen.ru",
  // Медиа / блоги
  "vc.ru", "dtf.ru", "habr.com", "sostav.ru", "rb.ru", "forbes.ru",
  "rbc.ru", "kommersant.ru", "vedomosti.ru", "incrussia.ru", "tadviser.ru",
  "pikabu.ru", "livejournal.com", "medium.com",
  // Рейтинги / агрегаторы отзывов
  "zoon.ru", "flamp.ru", "yell.ru", "otzovik.com", "irecommend.ru",
  "tripadvisor.com", "sravni.ru", "banki.ru", "ratingfirmporemontu.ru",
  // Поиск / карты / справочники
  "google.com", "yandex.ru", "2gis.ru", "yandex.ru",
  // Маркетплейсы / доски
  "ozon.ru", "wildberries.ru", "avito.ru", "youla.ru", "cian.ru", "domclick.ru",
  // Энциклопедии
  "wikipedia.org", "ru.wikipedia.org", "wikihow.com",
]);

function isNonCompetitor(url: string, targetDomain: string): boolean {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, "");
    const pathname = parsed.pathname.toLowerCase();

    if (domain === targetDomain) return true;
    if (AGGREGATOR_DOMAINS.has(domain)) return true;

    // Декодируем Punycode (xn--...) → unicode для проверки кириллицы
    let decodedDomain = domain;
    try { decodedDomain = new URL(`https://${domain}`).hostname; } catch {}

    const aggregatorPattern = /rating|reiting|рейтинг|лучш|top\d|топ\d|каталог|catalog|otzyv|review/;
    if (aggregatorPattern.test(decodedDomain)) return true;

    // Проверяем путь — агрегаторы часто имеют /rating/, /catalog/, /top-
    if (/\/rating\/|\/reiting\/|\/top-|\/catalog\/|\/otzyvy\//.test(pathname)) return true;

    return false;
  } catch {
    return false;
  }
}

export function isAggregatorDomain(url: string): boolean {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return AGGREGATOR_DOMAINS.has(domain);
  } catch {
    return false;
  }
}

// Только страны, которые DataForSEO SERP реально поддерживает
export const LOCATIONS: Record<string, { code: number; label: string }> = {
  US: { code: 2840, label: "США (Google.com)" },
  UK: { code: 2826, label: "Великобритания" },
  DE: { code: 2276, label: "Германия" },
  FR: { code: 2250, label: "Франция" },
  KZ: { code: 2398, label: "Казахстан (Русский язык)" },
  UA: { code: 2804, label: "Украина" },
};

const LOCATION_LANGUAGE: Record<number, string> = {
  2398: "ru", 2804: "ru",
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
  const task = data?.tasks?.[0];
  const taskStatus = task?.status_code;
  const taskMessage = task?.status_message ?? "";

  if (taskStatus && taskStatus !== 20000) {
    if (taskStatus === 40204 || taskMessage.includes("Access denied") || taskMessage.includes("activate your subscription")) {
      throw new Error("DataForSEO SERP API не активирован. Зайди в app.dataforseo.com → Plans and Subscriptions и включи SERP API.");
    }
    throw new Error(`DataForSEO SERP: ${taskStatus} — ${taskMessage}`);
  }

  const items = task?.result?.[0]?.items ?? [];
  const organic = items.filter((item: any) => item.type === "organic");

  if (organic.length === 0) {
    throw new Error(`DataForSEO SERP вернул 0 результатов для запроса "${searchQuery}". Проверь что SERP API активирован в app.dataforseo.com.`);
  }

  const targetDomain = new URL(url).hostname.replace(/^www\./, "");

  const competitors = organic
    .filter((item: any) => !isNonCompetitor(item.url ?? "", targetDomain))
    .slice(0, 10);

  if (competitors.length === 0) {
    throw new Error(`Не удалось найти реальных конкурентов в выдаче — все результаты оказались агрегаторами или соцсетями. Попробуй другой запрос.`);
  }

  return competitors.map((item: any, index: number) => ({
    domain: new URL(item.url).hostname,
    position: index + 1,
    title: item.title ?? "",
    url: item.url ?? "",
    snippet: item.description ?? "",
  }));
}

// ─────────────────────────────────────────
// SERP: топ-10 по запросу (без фильтрации целевого URL)
// Используется в niche mining — нам не нужно исключать "сам себя"
// ─────────────────────────────────────────

export async function fetchSerpResults(query: string, locationCode = 2840): Promise<SerpResult[]> {
  if (USE_MOCK) {
    return Array.from({ length: 10 }, (_, i) => ({
      domain: `competitor${i + 1}.com`,
      position: i + 1,
      title: `Result ${i + 1} for "${query}"`,
      url: `https://competitor${i + 1}.com/page`,
      snippet: `Mock snippet for query "${query}"`,
    }));
  }

  const languageCode = LOCATION_LANGUAGE[locationCode] ?? "en";

  const response = await fetch(`${BASE_URL}/serp/google/organic/live/advanced`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify([
      {
        keyword: query,
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
  const task = data?.tasks?.[0];
  const taskStatus = task?.status_code;

  if (taskStatus && taskStatus !== 20000) {
    throw new Error(`DataForSEO SERP: ${taskStatus} — ${task?.status_message ?? ""}`);
  }

  const items = task?.result?.[0]?.items ?? [];
  const organic = items.filter((item: any) => item.type === "organic");

  // Фильтруем только агрегаторы, но не исключаем "сам себя"
  const competitors = organic
    .filter((item: any) => !isAggregatorDomain(item.url ?? ""))
    .slice(0, 10);

  return competitors.map((item: any, index: number) => ({
    domain: new URL(item.url).hostname,
    position: index + 1,
    title: item.title ?? "",
    url: item.url ?? "",
    snippet: item.description ?? "",
  }));
}

// ─────────────────────────────────────────
// YANDEX SERP: для русскоязычных ниш (Москва, СПб и др.)
// Яндекс поддерживает гео-привязку к конкретным городам России
// ─────────────────────────────────────────

// Geo ID Яндекса (отличаются от Google location_code)
export const YANDEX_LOCATIONS: Record<string, { code: number; label: string }> = {
  MOSCOW:  { code: 213,  label: "Москва" },
  SPB:     { code: 2,    label: "Санкт-Петербург" },
  RU:      { code: 225,  label: "Россия (вся)" },
  EKATERINBURG: { code: 54, label: "Екатеринбург" },
  NOVOSIBIRSK:  { code: 65, label: "Новосибирск" },
};

export async function fetchYandexSerpResults(
  query: string,
  locationCode = 213
): Promise<SerpResult[]> {
  if (USE_MOCK) {
    return Array.from({ length: 10 }, (_, i) => ({
      domain: `competitor${i + 1}.ru`,
      position: i + 1,
      title: `Результат ${i + 1} для "${query}"`,
      url: `https://competitor${i + 1}.ru/page`,
      snippet: `Сниппет для запроса "${query}"`,
    }));
  }

  const response = await fetch(`${BASE_URL}/serp/yandex/organic/live/advanced`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify([
      {
        keyword: query,
        location_code: locationCode,
        language_code: "ru",
        depth: 10,
      },
    ]),
  });

  if (!response.ok) {
    let detail = "";
    try { const body = await response.json(); detail = JSON.stringify(body).slice(0, 200); } catch {}
    throw new Error(`DataForSEO Yandex SERP error: ${response.status}${detail ? " — " + detail : ""}`);
  }

  const data = await response.json();
  const task = data?.tasks?.[0];
  const taskStatus = task?.status_code;

  if (taskStatus && taskStatus !== 20000) {
    throw new Error(`DataForSEO Yandex: ${taskStatus} — ${task?.status_message ?? ""}`);
  }

  const items = task?.result?.[0]?.items ?? [];
  const organic = items.filter((item: any) => item.type === "organic");

  const competitors = organic
    .filter((item: any) => !isAggregatorDomain(item.url ?? ""))
    .slice(0, 10);

  return competitors.map((item: any, index: number) => ({
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

export async function fetchKeywords(keywords: string[], locationCode = 2840): Promise<KeywordData[]> {
  if (keywords.length === 0) return [];
  if (USE_MOCK) return getMockKeywords(keywords);

  const languageCode = LOCATION_LANGUAGE[locationCode] ?? "en";

  const response = await fetch(`${BASE_URL}/keywords_data/google_ads/search_volume/live`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify([
      {
        keywords,
        location_code: locationCode,
        language_code: languageCode,
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
    competition: typeof item.competition === "number" ? item.competition : 0,
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
      const domain = item.domain ?? item.name;
      const date = item.created_datetime ?? item.created_date ?? null;
      if (domain) whoisMap[domain] = date;
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

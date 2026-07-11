import * as cheerio from "cheerio";

const USE_MOCK = process.env.SCRAPER_MOCK === "true" || (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type SiteType = "ecommerce" | "content" | "local";

// Человекочитаемые названия блоков, которые определяет эвристика скрейпера
export const BLOCK_LABELS_RU: Record<string, string> = {
  reviews: "Отзывы клиентов",
  faq: "FAQ / вопросы-ответы",
  price: "Цены / прайс",
  comparison_table: "Таблица",
  gallery: "Галерея работ",
  social_proof: "Социальные доказательства (счётчики)",
  team: "Команда / специалисты",
  map: "Карта",
  calculator: "Калькулятор",
  chat: "Онлайн-чат",
  form: "Форма заявки",
  video: "Видео",
};

export interface PageSnapshot {
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  wordCount: number;
  headings: string[];        // h2 + h3, первые 15
  hasSchema: boolean;
  schemaTypes: string[];
  internalLinksCount: number;
  imagesCount: number;
  imagesWithAlt: number;
  detectedBlocks: string[];  // эвристика: ["reviews", "faq", "video", ...]
  siteType: SiteType;
  fetchError?: string;
  rawHtml?: string;          // очищенный HTML для downstream-анализа
}

type CheerioRoot = ReturnType<typeof cheerio.load>;

function detectBlocks($: CheerioRoot, schemaTypes: string[], bodyText: string): string[] {
  const blocks: string[] = [];
  const html = $.html();

  const hasClass = (...patterns: string[]) =>
    patterns.some((p) => new RegExp(`class="[^"]*${p}[^"]*"`, "i").test(html));

  // Отзывы / рейтинг
  if (
    schemaTypes.some((t) => ["Review", "AggregateRating"].includes(t)) ||
    hasClass("review", "testimonial", "rating", "отзыв") ||
    $("[itemprop='ratingValue'], [itemprop='reviewCount']").length > 0 ||
    /\d[\s,.]?\d*\s*(отзыв|review|покупател)/i.test(bodyText)
  ) blocks.push("reviews");

  // FAQ / аккордеон
  if (
    $("details").length > 0 ||
    hasClass("faq", "accordion", "collapse", "spoiler") ||
    $("[aria-expanded]").length > 2 ||
    /часто задаваем|faq|вопрос[ыи]|ответ[ыи]/i.test(bodyText.slice(0, 5000))
  ) blocks.push("faq");

  // Видео
  if (
    $("video").length > 0 ||
    $("iframe[src*='youtube'], iframe[src*='youtu.be'], iframe[src*='vimeo']").length > 0
  ) blocks.push("video");

  // Цена / прайс
  if (
    hasClass("price", "cost", "promo", "discount", "цена", "стоим") ||
    $("[itemprop='price'], [class*='price']").length > 0 ||
    /[₽$€]\s*\d|от\s+\d[\d\s]*[₽$€]/i.test(bodyText)
  ) blocks.push("price");

  // Таблица сравнения / характеристик
  if ($("table").filter((_, el) => $(el).find("tr").length > 2).length > 0)
    blocks.push("comparison_table");

  // Галерея (5+ изображений в одном контейнере)
  $("*").each((_, el) => {
    if ($(el).children("img").length >= 5) { blocks.push("gallery"); return false; }
  });

  // Счётчик / социальное доказательство
  if (/\d{3,}[\s+]*(клиент|покупател|заказ|пользовател|customer|order)/i.test(bodyText))
    blocks.push("social_proof");

  // Команда / специалисты
  if (
    hasClass("team", "staff", "команда", "специалист", "master", "мастер") ||
    /наша команда|специалисты|персонал|наши мастера|бригада/i.test(bodyText)
  ) blocks.push("team");

  // Калькулятор / конфигуратор
  if (
    hasClass("calculator", "configurator", "calc", "конфигур", "калькул") ||
    $("input[type='range'], input[type='number']").length > 1 ||
    /рассчита[тьй]|расчёт стоимости|расчет стоимости|узнать цену|посчитать|calculate|калькулятор/i.test(bodyText)
  ) blocks.push("calculator");

  // Карта / геолокация
  if (
    $("iframe[src*='maps.google'], iframe[src*='yandex.ru/maps']").length > 0 ||
    hasClass("map", "карта")
  ) blocks.push("map");

  // Форма обратной связи / заявки
  if ($("form").length > 0) blocks.push("form");

  // Чат / онлайн-консультант
  if (
    hasClass("chat", "livechat", "jivosite", "carrotquest", "tawk") ||
    html.includes("jivo") || html.includes("carrot")
  ) blocks.push("chat");

  return [...new Set(blocks)];
}

function detectSiteType(
  $: CheerioRoot,
  schemaTypes: string[],
  bodyText: string,
  detectedBlocks: string[]
): SiteType {
  const ecommScore = [
    schemaTypes.some((t) => ["Product", "Offer", "ItemList", "ProductGroup"].includes(t)),
    /добавить в корзину|купить сейчас|в корзину|buy now|add to cart/i.test(bodyText),
    $("[class*='cart'], [class*='basket'], [class*='корзин'], [id*='cart']").length > 0,
    detectedBlocks.includes("price") && (detectedBlocks.includes("gallery") || detectedBlocks.includes("reviews")),
    $("[class*='product'], [itemtype*='Product']").length > 2,
  ].filter(Boolean).length;

  const localScore = [
    schemaTypes.some((t) =>
      ["LocalBusiness", "Restaurant", "Store", "MedicalBusiness", "AutoDealer", "Hotel",
       "HomeAndConstructionBusiness", "GeneralContractor", "ProfessionalService",
       "RoofingContractor", "HVACBusiness", "Plumber", "Electrician"].includes(t)
    ),
    detectedBlocks.includes("map"),
    /режим работы|часы работы|пн[–-]пт|мы находимся|наш адрес/i.test(bodyText),
    $("address").length > 0,
    // телефон — сигнал локального бизнеса
    /\+7[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}|8[\s-]?800/i.test(bodyText),
    // упоминание города
    /санкт-петербург|москва|краснодар|новосибирск|екатеринбург|\bспб\b|\bмск\b|по городу|выезд мастера/i.test(bodyText),
    // сервисные CTA
    /оставить заявку|заказать звонок|рассчитать стоимость|получить смету|вызвать мастера/i.test(bodyText),
    // форма + цена = локальный сервис
    detectedBlocks.includes("form") && detectedBlocks.includes("price"),
  ].filter(Boolean).length;

  if (ecommScore >= 2) return "ecommerce";
  if (localScore >= 2) return "local";
  return "content";
}

// Полный набор браузерных заголовков: с датацентровых IP (Vercel) сайты
// отвечают 401/403 на голый User-Agent, но многие пропускают правдоподобный запрос.
// На 4xx — один ретрай с альтернативным UA.
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "cross-site",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  Referer: "https://www.google.com/",
};

const ALT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

async function fetchWithBrowserHeaders(url: string): Promise<Response> {
  const attempt = async (headers: Record<string, string>) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      return await fetch(url, { headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const first = await attempt(BROWSER_HEADERS);
  if (first.status === 401 || first.status === 403 || first.status === 429) {
    return attempt({ ...BROWSER_HEADERS, "User-Agent": ALT_USER_AGENT, "Sec-Ch-Ua-Platform": '"Windows"' });
  }
  return first;
}

// Fallback-добыча HTML через DataForSEO OnPage: их инфраструктура забирает
// страницы, которые блокируют датацентровые IP (Vercel). ~$0.0003/страница.
export async function fetchHtmlViaDataForSEO(url: string): Promise<string | null> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;

  const headers = {
    Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
    "Content-Type": "application/json",
  };

  try {
    const res = await fetch("https://api.dataforseo.com/v3/on_page/instant_pages", {
      method: "POST",
      headers,
      body: JSON.stringify([{ url, store_raw_html: true, accept_language: "ru-RU" }]),
    });
    const data = await res.json();
    const task = data.tasks?.[0];
    const pageStatus = task?.result?.[0]?.items?.[0]?.status_code;
    if (!task?.id || pageStatus !== 200) {
      console.warn(`[scraper] DFS instant_pages failed for ${url}: task=${task?.status_message}, page=${pageStatus}`);
      return null;
    }

    // raw_html большой страницы сохраняется не мгновенно — ретраим с паузой
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2500));
      const rawRes = await fetch("https://api.dataforseo.com/v3/on_page/raw_html", {
        method: "POST",
        headers,
        body: JSON.stringify([{ id: task.id }]),
      });
      const rawData = await rawRes.json();
      const items = rawData.tasks?.[0]?.result?.[0]?.items;
      // items приходит объектом { html }, но подстрахуемся и на массив
      const html = items?.html ?? items?.[0]?.html;
      if (typeof html === "string" && html.length > 500) return html;
    }
    console.warn(`[scraper] DFS raw_html empty after retries for ${url}`);
    return null;
  } catch (err) {
    console.warn(`[scraper] DFS fallback error for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function obtainHtml(url: string): Promise<{ html: string } | { fetchError: string }> {
  let directError: string;
  try {
    const res = await fetchWithBrowserHeaders(url);
    if (res.ok) {
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("html")) return { fetchError: `Not HTML: ${contentType}` };
      return { html: await res.text() };
    }
    directError = `HTTP ${res.status}`;
  } catch (err) {
    directError = err instanceof Error ? err.message : "Неизвестная ошибка";
  }

  const viaDfs = await fetchHtmlViaDataForSEO(url);
  if (viaDfs) return { html: viaDfs };
  return { fetchError: directError };
}

async function scrapePage(url: string): Promise<PageSnapshot> {
  const base: PageSnapshot = {
    url,
    title: "",
    metaDescription: "",
    h1: "",
    wordCount: 0,
    headings: [],
    hasSchema: false,
    schemaTypes: [],
    internalLinksCount: 0,
    imagesCount: 0,
    imagesWithAlt: 0,
    detectedBlocks: [],
    siteType: "content",
  };

  try {
    const obtained = await obtainHtml(url);
    if ("fetchError" in obtained) {
      return { ...base, fetchError: obtained.fetchError };
    }

    const $ = cheerio.load(obtained.html);

    // Удаляем шум перед подсчётом слов
    $("script, style, noscript, nav, footer, header, [aria-hidden='true']").remove();

    // Сохраняем очищенный HTML для downstream-анализа (niche mining и т.д.)
    const rawHtml = $.html();

    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const wordCount = bodyText.split(" ").filter((w) => w.length > 1).length;

    const schemaTypes: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() ?? "{}");
        const types = Array.isArray(json)
          ? json.map((o: any) => o["@type"]).filter(Boolean)
          : [json["@type"]].filter(Boolean);
        schemaTypes.push(...types.flat());
      } catch {
        // невалидный JSON — пропускаем
      }
    });

    const origin = new URL(url).origin;
    let internalLinksCount = 0;
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (href.startsWith("/") || href.startsWith(origin)) internalLinksCount++;
    });

    const images = $("img");
    const imagesWithAlt = images.filter((_, el) => !!$(el).attr("alt")).length;

    const headings: string[] = [];
    $("h2, h3").each((_, el) => {
      if (headings.length < 15) headings.push($(el).text().trim());
    });

    const uniqueSchemaTypes = [...new Set(schemaTypes)];
    const detectedBlocks = detectBlocks($, uniqueSchemaTypes, bodyText);
    const siteType = detectSiteType($, uniqueSchemaTypes, bodyText, detectedBlocks);

    return {
      url,
      title: $("title").first().text().trim(),
      metaDescription: $('meta[name="description"]').attr("content")?.trim() ?? "",
      h1: $("h1").first().text().trim(),
      wordCount,
      headings,
      hasSchema: uniqueSchemaTypes.length > 0,
      schemaTypes: uniqueSchemaTypes,
      internalLinksCount,
      imagesCount: images.length,
      imagesWithAlt,
      detectedBlocks,
      siteType,
      rawHtml,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
    return { ...base, fetchError: msg };
  }
}

function getMockSnapshot(url: string, isTarget = false): PageSnapshot {
  const mockHtml = `<html><head><title>Mock</title></head><body>
    <h1>Mock page</h1><p>This is mock content for testing niche mining pipeline.</p>
    <section class="reviews"><h2>Отзывы</h2><p>Отличный сервис!</p></section>
    <section class="faq"><h2>FAQ</h2><p>Часто задаваемые вопросы</p></section>
    <section class="calculator"><h2>Калькулятор</h2><button>Рассчитать</button></section>
  </body></html>`;

  if (isTarget) {
    return {
      url,
      title: "Купить диваны в Москве | МебельПлюс",
      metaDescription: "Большой выбор диванов. Доставка по Москве.",
      h1: "Диваны в Москве",
      wordCount: 820,
      headings: ["Виды диванов", "Цены на диваны", "Доставка"],
      hasSchema: false,
      schemaTypes: [],
      internalLinksCount: 12,
      imagesCount: 8,
      imagesWithAlt: 3,
      detectedBlocks: ["price", "form"],
      siteType: "ecommerce",
      rawHtml: mockHtml,
    };
  }
  const pos = parseInt(new URL(url).hostname.replace("competitor", "")) || 1;
  const competitorBlocks = ["price", "reviews", "gallery", "form"];
  if (pos <= 2) competitorBlocks.push("faq", "social_proof");
  if (pos === 1) competitorBlocks.push("video", "calculator", "chat");
  return {
    url,
    title: `Диваны купить — ${2000 + pos * 50} моделей от ${12000 + pos * 500} ₽ | TopMebel`,
    metaDescription: `Купить диван в Москве по лучшей цене. Доставка за 1 день. ${pos * 300}+ отзывов.`,
    h1: `Диваны в Москве — каталог ${2000 + pos * 50} моделей`,
    wordCount: 1800 + pos * 200,
    headings: [
      "Угловые диваны",
      "Прямые диваны",
      "Диваны-кровати",
      "Как выбрать диван",
      "Материалы обивки",
      "Доставка и сборка",
    ],
    hasSchema: pos <= 3,
    schemaTypes: pos <= 3 ? ["Product", "BreadcrumbList"] : [],
    internalLinksCount: 45 + pos * 10,
    imagesCount: 20 + pos * 5,
    imagesWithAlt: 18 + pos * 4,
    detectedBlocks: competitorBlocks,
    siteType: "ecommerce",
    rawHtml: mockHtml,
  };
}

export async function scrapePages(
  targetUrl: string,
  competitorUrls: string[]
): Promise<{ target: PageSnapshot; competitors: PageSnapshot[] }> {
  if (USE_MOCK) {
    return {
      target: getMockSnapshot(targetUrl, true),
      competitors: competitorUrls.map((u) => getMockSnapshot(u)),
    };
  }

  const [target, ...competitors] = await Promise.all([
    scrapePage(targetUrl),
    ...competitorUrls.map(scrapePage),
  ]);

  return { target, competitors };
}

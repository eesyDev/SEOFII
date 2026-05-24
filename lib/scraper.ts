import * as cheerio from "cheerio";

const USE_MOCK = !process.env.ANTHROPIC_API_KEY;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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
  fetchError?: string;
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

  // Калькулятор / конфигуратор
  if (
    hasClass("calculator", "configurator", "calc", "конфигур", "калькул") ||
    $("input[type='range'], input[type='number']").length > 1
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
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      return { ...base, fetchError: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return { ...base, fetchError: `Not HTML: ${contentType}` };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Удаляем шум перед подсчётом слов
    $("script, style, noscript, nav, footer, header, [aria-hidden='true']").remove();

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

    const detectedBlocks = detectBlocks($, schemaTypes, bodyText);

    return {
      url,
      title: $("title").first().text().trim(),
      metaDescription: $('meta[name="description"]').attr("content")?.trim() ?? "",
      h1: $("h1").first().text().trim(),
      wordCount,
      headings,
      hasSchema: schemaTypes.length > 0,
      schemaTypes: [...new Set(schemaTypes)],
      internalLinksCount,
      imagesCount: images.length,
      imagesWithAlt,
      detectedBlocks,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
    return { ...base, fetchError: msg };
  }
}

function getMockSnapshot(url: string, isTarget = false): PageSnapshot {
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

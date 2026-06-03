import * as cheerio from "cheerio";

/**
 * Преобразует HTML страницы в очищенный Markdown для анализа Gemini.
 * Удаляет мусор (скрипты, стили, навигацию) и агрегаторные паттерны.
 */

// Домены-агрегаторы, которые искажают паттерны ниши
const AGGREGATOR_PATTERNS = [
  "avito",
  "yandex",
  "youla",
  "cian",
  "irr",
  "domclick",
  "samokat",
  "ozon",
  "wildberries",
  "aliexpress",
  "market",
];

export function isAggregator(url: string): boolean {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    return AGGREGATOR_PATTERNS.some((p) => domain.includes(p));
  } catch {
    return false;
  }
}

export interface CleanedPage {
  domain: string;
  url: string;
  markdown: string;
  wordCount: number;
  headings: string[];
  buttons: string[];
}

export function htmlToMiningMarkdown(html: string, url: string): CleanedPage {
  const $ = cheerio.load(html);
  const domain = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  // 1. Удаляем мусор
  $("script, style, nav, footer, header, aside, noscript, iframe, svg, canvas").remove();

  // 2. Удаляем агрегаторные блоки по классам/идентификаторам
  $('[class*="avito"], [id*="avito"]').remove();
  $('[class*="yandex"], [id*="yandex"]').remove();
  $('[class*="market"], [id*="market"]').remove();

  // 3. Собираем заголовки
  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 0 && text.length < 200) headings.push(text);
  });

  // 4. Собираем кнопки / CTA
  const buttons: string[] = [];
  $("button, a[role='button'], input[type='submit'], .btn, [class*='button']").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 0 && text.length < 100) buttons.push(text);
  });

  // 5. Извлекаем текст по секциям (main, article, section)
  const sections: string[] = [];
  const processed = new Set<string>();

  $("main, article, section").each((_, el) => {
    const $el = $(el);
    // Избегаем вложенных дубликатов
    const text = $el.text().trim();
    const key = text.slice(0, 200);
    if (processed.has(key)) return;
    processed.add(key);

    if (text.length > 100) {
      const h = $el.find("h1, h2, h3").first().text().trim();
      const lines: string[] = [];
      if (h) lines.push(`## ${h}`);
      lines.push(text.slice(0, 3000));
      sections.push(lines.join("\n"));
    }
  });

  // Если не нашли семантических тегов — берём body
  if (sections.length === 0) {
    const bodyText = $("body").text().trim().slice(0, 8000);
    sections.push(bodyText);
  }

  const markdown = sections.join("\n\n---\n\n").slice(0, 12000);
  const wordCount = markdown.split(/\s+/).length;

  return {
    domain,
    url,
    markdown,
    wordCount,
    headings: headings.slice(0, 30),
    buttons: [...new Set(buttons)].slice(0, 20),
  };
}

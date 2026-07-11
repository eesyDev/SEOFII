// Инвентаризация сайта: какие страницы уже существуют.
// Нужно, чтобы «Что создать дальше» не рекомендовал создать то, что уже есть.
// Источники: sitemap.xml (+ sitemap_index) и внутренние ссылки анализируемой страницы.

import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1]);
}

async function pathsFromSitemap(origin: string, host: string): Promise<string[]> {
  const paths: string[] = [];
  for (const smPath of ["/sitemap.xml", "/sitemap_index.xml"]) {
    const xml = await fetchText(origin + smPath);
    if (!xml) continue;

    let locs = extractSitemapLocs(xml);
    // sitemap-индекс: качаем до 5 вложенных карт
    if (/<sitemapindex/i.test(xml)) {
      const nested = await Promise.all(
        locs.slice(0, 5).map((l) => fetchText(l))
      );
      locs = nested.filter(Boolean).flatMap((x) => extractSitemapLocs(x!));
    }

    for (const loc of locs) {
      try {
        const u = new URL(loc);
        if (u.hostname.replace(/^www\./, "") === host) paths.push(u.pathname);
      } catch { /* пропускаем битые URL */ }
    }
    if (paths.length > 0) break;
  }
  return paths;
}

function pathsFromInternalLinks(rawHtml: string, host: string): string[] {
  const $ = cheerio.load(rawHtml);
  const paths = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    try {
      const u = new URL(href, `https://${host}`);
      if (u.hostname.replace(/^www\./, "") === host && u.pathname !== "/") {
        paths.add(u.pathname);
      }
    } catch { /* не URL */ }
  });
  return [...paths];
}

export async function fetchSitePaths(pageUrl: string, rawHtml?: string): Promise<string[]> {
  let origin: string, host: string;
  try {
    const u = new URL(pageUrl);
    origin = u.origin;
    host = u.hostname.replace(/^www\./, "");
  } catch {
    return [];
  }

  const fromSitemap = await pathsFromSitemap(origin, host).catch(() => []);
  const fromLinks = rawHtml ? pathsFromInternalLinks(rawHtml, host) : [];

  const all = [...new Set([...fromSitemap, ...fromLinks])]
    .filter((p) => !/\.(jpg|jpeg|png|gif|webp|pdf|css|js|xml)$/i.test(p))
    .slice(0, 200);

  return all;
}

// ─────────────────────────────────────────
// Сопоставление предлагаемого slug с существующими страницами
// ─────────────────────────────────────────

interface SlugToken {
  stem: string;            // 5 символов — сглаживает транслитерацию (vannoj/vannoy → vanno)
  rareStem: string | null; // для длинных редких слов — 7 символов, против коллизий (novostroyke ≠ novosibirskaya)
}

function slugTokens(slug: string): SlugToken[] {
  return slug
    .toLowerCase()
    .split(/[-/_.]+/)
    .filter((t) => t.length >= 4)
    .map((t) => ({ stem: t.slice(0, 5), rareStem: t.length >= 9 ? t.slice(0, 7) : null }));
}

// Возвращает существующий путь, похожий на предлагаемый slug, или null.
// Общие для ниши слова (remont, kvartiry) есть в каждом URL сайта, поэтому
// решает не число совпадений, а покрытие: какая доля токенов СУЩЕСТВУЮЩЕГО
// пути совпала. "/kalkulyator/" покрыт на 100% — он и есть похожая страница,
// а случайный пост блога с remont+kvartiry — только на треть.
export function findSimilarExistingPath(suggestedSlug: string, existingPaths: string[]): string | null {
  const tokens = slugTokens(suggestedSlug);
  if (tokens.length === 0) return null;

  let best: { path: string; coverage: number } | null = null;
  for (const path of existingPaths) {
    const pathLower = path.toLowerCase();
    const matched = tokens.filter((t) => pathLower.includes(t.rareStem ?? t.stem));
    if (matched.length === 0) continue;

    const rareMatch = matched.some((t) => t.rareStem !== null);
    const slugHasRare = tokens.some((t) => t.rareStem !== null);
    const pathStems = slugTokens(path).map((t) => t.stem);
    const coveredPathTokens = pathStems.filter((s) =>
      matched.some((m) => m.stem === s || s.includes(m.stem) || m.stem.includes(s))
    );
    const coverage = pathStems.length > 0 ? coveredPathTokens.length / pathStems.length : 0;

    // Редкое слово (kalkulyator, portfolio, novostroyke) — главный маркер темы:
    // если оно в slug есть, но в пути не совпало — это ДРУГАЯ страница, пропускаем.
    // Без редких слов — минимум два общих совпадения, покрывающих >50% пути.
    const qualifies = rareMatch || (!slugHasRare && matched.length >= 2 && coverage > 0.5);
    if (!qualifies) continue;

    if (
      !best ||
      coverage > best.coverage ||
      (coverage === best.coverage && path.length < best.path.length)
    ) {
      best = { path, coverage };
    }
  }
  return best?.path ?? null;
}

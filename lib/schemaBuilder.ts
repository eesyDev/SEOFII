/**
 * Строит связанный schema.org граф для страницы.
 * Базируется на ТЗ по GEO/AEO: Organization → WebSite → WebPage → Service/Article → FAQPage.
 * Реальные данные берём из скрапера, плейсхолдеры — только там где данных нет.
 */

import type { PageSnapshot } from "./scraper";
import type { SEOBrief } from "./claude";
import type { PageType } from "./nichePatterns";
import type { SiteType } from "./scraper";

export interface SchemaBlock {
  type: string;
  description: string;
  code: string;
}

export interface SchemaResult {
  schemas: SchemaBlock[];
}

// ─────────────────────────────────────────
// Извлечение реальных данных из скрапера
// ─────────────────────────────────────────

function extractBusinessName(snapshot: PageSnapshot): string {
  // Пробуем вытащить имя из title: "Имя компании | Услуга" или "Услуга — Имя компании"
  const title = snapshot.title;
  const separators = [" | ", " — ", " - ", " · "];
  for (const sep of separators) {
    const parts = title.split(sep);
    if (parts.length >= 2) {
      // Берём более короткую часть — обычно это название компании
      const shorter = parts.reduce((a, b) => a.length <= b.length ? a : b).trim();
      if (shorter.length > 2 && shorter.length < 50) return shorter;
    }
  }
  // Fallback: домен без www и TLD
  try {
    const host = new URL(snapshot.url).hostname.replace(/^www\./, "");
    return host.split(".")[0];
  } catch {
    return "";
  }
}

function extractCity(snapshot: PageSnapshot): string {
  const cities: Record<string, string> = {
    "санкт-петербург": "Санкт-Петербург", "спб": "Санкт-Петербург", "петербург": "Санкт-Петербург",
    "москва": "Москва", "мск": "Москва",
    "краснодар": "Краснодар", "екатеринбург": "Екатеринбург",
    "новосибирск": "Новосибирск", "казань": "Казань", "нижний новгород": "Нижний Новгород",
  };
  const text = (snapshot.title + " " + snapshot.h1 + " " + snapshot.metaDescription).toLowerCase();
  for (const [key, city] of Object.entries(cities)) {
    if (text.includes(key)) return city;
  }
  return "";
}

function extractPhone(snapshot: PageSnapshot): string {
  // rawHtml может содержать телефон
  const text = snapshot.rawHtml ?? snapshot.metaDescription;
  const match = text?.match(/\+7[\s\-]?\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})/);
  if (match) return match[0].replace(/\s/g, "");
  return "";
}

function extractServiceType(siteType: SiteType, keyword: string): string {
  if (siteType === "ecommerce") return "Интернет-магазин";
  if (keyword) {
    if (/ремонт|отделк|строительств/.test(keyword)) return "Ремонтно-строительные услуги";
    if (/стоматолог|зуб|имплант/.test(keyword)) return "Стоматологические услуги";
    if (/юрист|адвокат/.test(keyword)) return "Юридические услуги";
    if (/автосервис|шиномонтаж/.test(keyword)) return "Автосервисные услуги";
    if (/красот|салон|маникюр/.test(keyword)) return "Услуги красоты";
  }
  return "Профессиональные услуги";
}

// ─────────────────────────────────────────
// Типы Organization в зависимости от ниши
// ─────────────────────────────────────────

function getOrgType(siteType: SiteType, keyword: string): string {
  if (/стоматолог|стоматолог/.test(keyword)) return "Dentist";
  if (/юрист|адвокат/.test(keyword)) return "LegalService";
  if (/ремонт|строительств|отделк/.test(keyword)) return "HomeAndConstructionBusiness";
  if (/красот|салон|спа/.test(keyword)) return "BeautySalon";
  if (/автосервис|шиномонтаж/.test(keyword)) return "AutoRepair";
  if (siteType === "ecommerce") return "Store";
  if (siteType === "local") return "LocalBusiness";
  return "Organization";
}

// ─────────────────────────────────────────
// Строители блоков
// ─────────────────────────────────────────

function buildOrgAndSite(
  url: string,
  snapshot: PageSnapshot,
  brief: SEOBrief,
  siteType: SiteType
): SchemaBlock {
  const base = new URL(url).origin;
  const orgId = `${base}/#organization`;
  const siteId = `${base}/#website`;
  const name = extractBusinessName(snapshot) || brief.recommendedH1?.split(" ")[0] || base;
  const city = extractCity(snapshot);
  const phone = extractPhone(snapshot);
  const orgType = getOrgType(siteType, brief.targetKeyword ?? "");

  const org: Record<string, unknown> = {
    "@type": orgType,
    "@id": orgId,
    "name": name,
    "url": base + "/",
    "description": brief.recommendedMetaDescription || snapshot.metaDescription || undefined,
    "inLanguage": "ru-RU",
  };

  if (phone) org["telephone"] = phone;
  if (city) {
    org["address"] = {
      "@type": "PostalAddress",
      "addressLocality": city,
      "addressCountry": "RU",
    };
    org["areaServed"] = { "@type": "City", "name": city };
  }

  const website: Record<string, unknown> = {
    "@type": "WebSite",
    "@id": siteId,
    "url": base + "/",
    "name": name,
    "publisher": { "@id": orgId },
    "inLanguage": "ru-RU",
  };

  const graph = { "@context": "https://schema.org", "@graph": [org, website] };

  return {
    type: orgType + " + WebSite",
    description: "Сущность бренда и сайта — закрепляет название, контакты и издателя",
    code: JSON.stringify(graph, null, 2),
  };
}

function buildWebPageAndService(
  url: string,
  snapshot: PageSnapshot,
  brief: SEOBrief,
  siteType: SiteType,
  pageType: PageType
): SchemaBlock {
  const base = new URL(url).origin;
  const pageId = `${url}#webpage`;
  const siteId = `${base}/#website`;
  const orgId = `${base}/#organization`;
  const serviceId = `${url}#service`;

  const webPageType =
    pageType === "article" ? "BlogPosting" :
    pageType === "portfolio" ? "CollectionPage" :
    pageType === "price" ? "WebPage" :
    "WebPage";

  const webpage: Record<string, unknown> = {
    "@type": webPageType,
    "@id": pageId,
    "url": url,
    "name": brief.recommendedTitle || snapshot.title,
    "description": brief.recommendedMetaDescription || snapshot.metaDescription || undefined,
    "isPartOf": { "@id": siteId },
    "publisher": { "@id": orgId },
    "inLanguage": "ru-RU",
    "dateModified": new Date().toISOString().split("T")[0],
  };

  const nodes: unknown[] = [webpage];

  // Для сервисных/локальных страниц добавляем Service
  if (siteType === "local" || siteType === "ecommerce") {
    const service: Record<string, unknown> = {
      "@type": siteType === "ecommerce" ? "Product" : "Service",
      "@id": serviceId,
      "name": brief.recommendedH1 || snapshot.h1,
      "provider": { "@id": orgId },
      "url": url,
    };

    const serviceType = extractServiceType(siteType, brief.targetKeyword ?? "");
    if (serviceType) service["serviceType"] = serviceType;

    const city = extractCity(snapshot);
    if (city) service["areaServed"] = { "@type": "City", "name": city };

    webpage["about"] = { "@id": serviceId };
    nodes.push(service);
  }

  // Хлебные крошки из URL
  const crumbs = buildBreadcrumbs(url);
  if (crumbs) nodes.push(crumbs);

  const graph = { "@context": "https://schema.org", "@graph": nodes };

  return {
    type: webPageType + (siteType !== "content" ? " + Service + BreadcrumbList" : " + BreadcrumbList"),
    description: "Страница как объект + основная сущность + иерархия навигации",
    code: JSON.stringify(graph, null, 2),
  };
}

function buildBreadcrumbs(url: string): unknown | null {
  try {
    const parsed = new URL(url);
    const base = parsed.origin;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null; // главная — крошки не нужны

    const items: unknown[] = [
      { "@type": "ListItem", "position": 1, "name": "Главная", "item": base + "/" }
    ];

    let current = base;
    for (let i = 0; i < parts.length; i++) {
      current += "/" + parts[i];
      const name = parts[i]
        .replace(/[-_]/g, " ")
        .replace(/^\w/, c => c.toUpperCase());
      items.push({ "@type": "ListItem", "position": i + 2, "name": name, "item": current + "/" });
    }

    return {
      "@type": "BreadcrumbList",
      "@id": url + "#breadcrumb",
      "itemListElement": items,
    };
  } catch {
    return null;
  }
}

function buildFaqSchema(url: string, snapshot: PageSnapshot, brief: SEOBrief): SchemaBlock | null {
  // Только если на странице реально есть FAQ
  if (!snapshot.detectedBlocks.includes("faq")) return null;

  // Берём вопросы из брифа если есть
  const faqItems = brief.contentStructure
    ?.filter(s => /вопрос|faq|частые/i.test(s.title))
    .flatMap(s => [{
      "@type": "Question",
      "name": s.title,
      "acceptedAnswer": { "@type": "Answer", "text": s.content },
    }]) ?? [];

  if (faqItems.length === 0) {
    // Генерим заглушки из ключевых слов
    faqItems.push({
      "@type": "Question",
      "name": `Сколько стоит ${brief.targetKeyword ?? "услуга"}?`,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[ЗАПОЛНИТЬ: конкретный ответ с ценой]",
      },
    });
  }

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": url + "#faq",
    "mainEntity": faqItems.slice(0, 5),
  };

  return {
    type: "FAQPage",
    description: "Структурирует FAQ — может дать расширенный сниппет с вопросами в выдаче",
    code: JSON.stringify(schema, null, 2),
  };
}

function buildReviewSchema(url: string, snapshot: PageSnapshot): SchemaBlock | null {
  if (!snapshot.detectedBlocks.includes("reviews")) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": url + "#service",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "[ЗАПОЛНИТЬ: средняя оценка, например 4.8]",
      "reviewCount": "[ЗАПОЛНИТЬ: количество отзывов]",
      "bestRating": "5",
      "worstRating": "1",
    },
  };

  return {
    type: "AggregateRating",
    description: "Рейтинг из реальных отзывов — показывает звёзды в выдаче (только с реальными данными!)",
    code: JSON.stringify(schema, null, 2),
  };
}

// ─────────────────────────────────────────
// Главная функция
// ─────────────────────────────────────────

export function buildSchemaGraph(
  url: string,
  snapshot: PageSnapshot,
  brief: SEOBrief,
  siteType: SiteType,
  pageType: PageType
): SchemaResult {
  const schemas: SchemaBlock[] = [];

  // 1. Всегда: Organization + WebSite
  schemas.push(buildOrgAndSite(url, snapshot, brief, siteType));

  // 2. Всегда: WebPage + Service/Product + BreadcrumbList
  schemas.push(buildWebPageAndService(url, snapshot, brief, siteType, pageType));

  // 3. Условно: FAQPage (только если есть FAQ на странице)
  const faq = buildFaqSchema(url, snapshot, brief);
  if (faq) schemas.push(faq);

  // 4. Условно: AggregateRating (только если есть отзывы)
  const reviews = buildReviewSchema(url, snapshot);
  if (reviews) schemas.push(reviews);

  return { schemas };
}

// Клиент для Claude API (Anthropic)
// Генерирует SEO ТЗ на основе данных о конкурентах и ключевых словах
// Если ANTHROPIC_API_KEY не задан — возвращает мок-данные для разработки
import Anthropic from "@anthropic-ai/sdk";
import type { SerpResult, KeywordData, DomainInfo } from "./dataforseo";
import type { AnalyticsResult } from "./analytics";
import type { GscRow } from "./gsc";
import type { PageSnapshot, SiteType } from "./scraper";

const USE_MOCK = !process.env.ANTHROPIC_API_KEY;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────
// ТИПЫ
// ─────────────────────────────────────────

export interface BriefSection {
  title: string;
  content: string;
}

export interface EEATScore {
  score: number;
  signals: string[];
  gaps: string[];
}

export interface EEATAnalysis {
  experience: EEATScore;
  expertise: EEATScore;
  authoritativeness: EEATScore;
  trustworthiness: EEATScore;
  overallScore: number;
  summary: string;
  recommendations: string[];
}

export interface LinkBuildingRecommendation {
  type: string;
  description: string;
  priority: "high" | "medium" | "low";
  examples: string[];
}

export interface LinkBuildingStrategy {
  summary: string;
  targetDR: string;
  recommendations: LinkBuildingRecommendation[];
  anchorTextStrategy: string;
}

export interface ContentGap {
  topic: string;
  suggestedSlug: string;
  priority: "high" | "medium" | "low";
  trafficPotential: string;
  rationale: string;
}

export interface SEOBrief {
  targetKeyword: string;
  recommendedTitle: string;
  recommendedMetaDescription: string;
  recommendedH1: string;
  contentStructure: BriefSection[];
  wordCountRecommendation: number;
  topKeywordsToInclude: string[];
  competitorInsights: string;
  additionalRecommendations: string[];
  eeatAnalysis: EEATAnalysis;
  contentGaps: ContentGap[];
  linkBuildingStrategy: LinkBuildingStrategy;
  domainInfo?: Record<string, { domainAge: string | null; referringDomains: number }>;
}

export interface ComparisonReason {
  category: "content" | "structure" | "keywords" | "technical" | "eeat";
  finding: string;       // "У него 2400 слов, у тебя 820"
  recommendation: string; // "Расширь до 2000+ слов — добавь раздел про X"
  impact: "high" | "medium" | "low";
}

export interface CompetitorComparison {
  competitorUrl: string;
  competitorPosition: number;
  reasons: ComparisonReason[]; // ровно 5
  summary: string;
}

export interface QuickFix {
  action: string;   // конкретное действие с примером
  where: string;    // URL или "заголовок сайта"
  effort: "5min" | "30min" | "2hours";
  why: string;      // ожидаемый эффект без терминов
  category: "meta" | "content" | "links" | "technical";
}

export interface BlockRow {
  block: string;           // "Отзывы покупателей"
  yours: boolean;
  competitors: boolean[];  // по одному на каждого конкурента
  priority: "must" | "consider" | "optional";
  tip: string;             // что именно добавить, без жаргона
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ReadyContent {
  title: string;
  h1: string;
  metaDescription: string;
  introParagraph: string;
  faqItems: FaqItem[];
  schemaMarkup: string; // JSON-LD ready to paste into <head>
}

export interface ClaudeResult {
  brief: SEOBrief;
  comparisons: CompetitorComparison[];
  blockMatrix: BlockRow[];
  quickFixes: QuickFix[];
  // Стоимость в USD: входящие токены дороже исходящих
  costUsd: number;
}

// ─────────────────────────────────────────
// МОК — возвращается когда нет API ключа
// ─────────────────────────────────────────

function getMockComparisons(competitors: SerpResult[]): CompetitorComparison[] {
  return competitors.map((c) => ({
    competitorUrl: c.url,
    competitorPosition: c.position,
    summary: `Страница конкурента превосходит вашу по объёму контента, структуре и техническим сигналам`,
    reasons: [
      {
        category: "content",
        finding: `У конкурента ${1800 + c.position * 100} слов, у вас ~820`,
        recommendation: `Расширьте статью до 2000+ слов — добавьте разделы с ответами на часто задаваемые вопросы`,
        impact: "high",
      },
      {
        category: "structure",
        finding: `Конкурент использует 6 подзаголовков H2/H3, у вас 3`,
        recommendation: `Добавьте разделы "Как выбрать", "Виды", "Частые ошибки" — это улучшает читаемость и ранжирование`,
        impact: "high",
      },
      {
        category: "technical",
        finding: `У конкурента есть schema.org разметка (Product, BreadcrumbList), у вас нет`,
        recommendation: `Добавьте JSON-LD разметку — это даёт расширенные сниппеты в поиске и повышает CTR`,
        impact: "medium",
      },
      {
        category: "keywords",
        finding: `Конкурент упоминает целевой запрос в title, H1 и первом абзаце, у вас только в H1`,
        recommendation: `Добавьте ключевой запрос в title (до 60 символов) и первый абзац страницы`,
        impact: "medium",
      },
      {
        category: "eeat",
        finding: `На странице конкурента есть блок с отзывами и счётчик "2300 покупателей выбрали"`,
        recommendation: `Добавьте 5–10 реальных отзывов и счётчик продаж — это сигнал доверия для Google`,
        impact: "low",
      },
    ],
  }));
}

function getMockQuickFixes(targetUrl: string): QuickFix[] {
  return [
    {
      action: `Измените title страницы на: "Купить диваны в Москве — 500 моделей от 15 000 ₽ | МебельПлюс"`,
      where: targetUrl,
      effort: "5min",
      why: `Текущий title не содержит цену и количество — конкуренты в топ-3 используют эти триггеры. CTR вырастет на 15–25%.`,
      category: "meta",
    },
    {
      action: `Добавьте раздел "Как выбрать диван: 5 вопросов" с ответами на 300–400 слов`,
      where: targetUrl,
      effort: "2hours",
      why: `Этот раздел есть у 4 из 5 конкурентов в топ-5. Google видит что вы не отвечаете на вопрос пользователя — страница теряет позиции.`,
      category: "content",
    },
    {
      action: `Добавьте JSON-LD разметку Product на страницу (схема готова — скопируйте и вставьте в <head>)`,
      where: targetUrl,
      effort: "30min",
      why: `Без schema.org у вас нет шансов на расширенный сниппет с ценой и рейтингом — конкуренты с разметкой получают на 30% больше кликов.`,
      category: "technical",
    },
    {
      action: `Добавьте 3–5 внутренних ссылок с категорий "Угловые диваны" и "Диваны-кровати" на эту страницу`,
      where: `Страницы категорий сайта`,
      effort: "30min",
      why: `У конкурентов в среднем 45 внутренних ссылок на страницу, у вас 12. Внутренняя перелинковка — самый быстрый способ поднять страницу.`,
      category: "links",
    },
  ];
}

function getMockBrief(targetUrl: string, competitors: SerpResult[]): { brief: SEOBrief; costUsd: number } {
  const domain = new URL(targetUrl).hostname;
  return {
    brief: {
      targetKeyword: `seo services for ${domain}`,
      recommendedTitle: `Best SEO Services 2025 | ${domain} — Top Ranked`,
      recommendedMetaDescription: `Discover the best SEO strategies for ${domain}. Expert analysis, competitor insights, and actionable recommendations for top rankings.`,
      recommendedH1: `Complete SEO Guide for ${domain}`,
      contentStructure: [
        { title: "Введение", content: "Обзор темы, почему это важно, что читатель узнает" },
        { title: "Анализ конкурентов", content: `Разбор топ-${competitors.length} сайтов в выдаче, их сильные стороны` },
        { title: "Ключевые стратегии", content: "3–5 конкретных тактик с примерами" },
        { title: "Техническая оптимизация", content: "Скорость, структура, schema markup" },
        { title: "Заключение + CTA", content: "Итоги, следующий шаг для читателя" },
      ],
      wordCountRecommendation: 1800,
      topKeywordsToInclude: ["seo optimization", "search ranking", "organic traffic", "keyword research", "on-page seo"],
      competitorInsights: `[МОК] Проанализированы ${competitors.length} конкурентов из топ-10. Средний объём контента — 1500–2000 слов. Все используют структурированные данные schema.org.`,
      additionalRecommendations: [
        "Добавить FAQ-блок для попадания в featured snippets",
        "Внутренняя перелинковка минимум 3–5 релевантных статей",
        "Оптимизировать изображения (alt-теги, WebP формат)",
      ],
      eeatAnalysis: {
        experience: {
          score: 6,
          signals: [
            "Конкуренты упоминают реальные кейсы и результаты",
            "Некоторые страницы содержат скриншоты и примеры из практики",
          ],
          gaps: [
            "Большинство не указывают конкретный опыт автора в годах",
            "Нет упоминания личных экспериментов или тестов",
          ],
        },
        expertise: {
          score: 7,
          signals: [
            "Используется профессиональная терминология",
            "Ссылки на исследования и официальную документацию Google",
            "Структурированные объяснения сложных концепций",
          ],
          gaps: [
            "Биографии авторов присутствуют менее чем у 50% конкурентов",
            "Нет академических или профессиональных регалий",
          ],
        },
        authoritativeness: {
          score: 5,
          signals: [
            "Несколько конкурентов упомянуты в отраслевых изданиях",
            "Присутствуют отзывы и рейтинги",
          ],
          gaps: [
            "Отсутствуют ссылки от авторитетных доменов (.edu, .gov)",
            "Нет партнёрств с признанными организациями",
            "Нет упоминаний в крупных медиа",
          ],
        },
        trustworthiness: {
          score: 7,
          signals: [
            "HTTPS у всех конкурентов",
            "Политика конфиденциальности и условия использования присутствуют",
            "Контактная информация указана",
          ],
          gaps: [
            "Нет явного раскрытия методологии",
            "Дата последнего обновления отсутствует у большинства",
          ],
        },
        overallScore: 6,
        summary: "[МОК] Конкуренты демонстрируют средний уровень E-E-A-T. Наибольшие возможности для отстройки — в экспертизе (биография автора) и авторитетности (внешние упоминания). Доверие можно повысить прозрачностью: датой обновления, методологией, источниками.",
        recommendations: [
          "Добавить биографию автора с конкретными регалиями и опытом (не менее 150 слов)",
          "Включить раздел «Как мы тестировали» или «Методология» — это сигнал Experience",
          "Цитировать минимум 3–5 авторитетных источников: Google Search Central, исследования Moz/Ahrefs",
          "Указать дату публикации и последнего обновления статьи",
          "Добавить schema.org разметку: Article, Person, Organization",
          "Включить реальные примеры и кейсы с цифрами для демонстрации опыта",
        ],
      },
      linkBuildingStrategy: {
        summary: "[МОК] Конкуренты имеют в среднем 500–2000 ссылающихся доменов с DR 30–60. Для конкуренции в топ-5 потребуется 80–150 качественных referring domains за 6–12 месяцев.",
        targetDR: "30–60",
        recommendations: [
          {
            type: "Гостевые посты",
            description: "Публикации на отраслевых блогах и СМИ с естественными анкорами",
            priority: "high",
            examples: ["searchenginejournal.com", "moz.com/blog", "ahrefs.com/blog"],
          },
          {
            type: "Niche Edits",
            description: "Вставка ссылки в существующие релевантные статьи (быстрее гостевых постов)",
            priority: "high",
            examples: ["Статьи про SEO-оптимизацию", "Обзоры инструментов для SEO"],
          },
          {
            type: "HARO / журналистские запросы",
            description: "Ответы на запросы журналистов — ссылки с высокоавторитетных доменов",
            priority: "medium",
            examples: ["Forbes", "Entrepreneur", "Inc."],
          },
          {
            type: "Каталоги и агрегаторы",
            description: "Размещение в тематических каталогах инструментов и сервисов",
            priority: "low",
            examples: ["G2", "Capterra", "Product Hunt"],
          },
        ],
        anchorTextStrategy: "60% брендовые анкоры, 25% общие («здесь», «подробнее»), 15% ключевые слова в разбавленном виде. Избегать точного вхождения основного ключа в анкоре более 5%.",
      },
      contentGaps: [
        {
          topic: "Чек-лист SEO-аудита сайта",
          suggestedSlug: "/blog/seo-audit-checklist",
          priority: "high",
          trafficPotential: "1000–3000 посещений/мес",
          rationale: "7 из 10 конкурентов имеют подобную страницу — это один из самых запрашиваемых форматов в нише",
        },
        {
          topic: "SEO для e-commerce: пошаговое руководство",
          suggestedSlug: "/blog/ecommerce-seo-guide",
          priority: "high",
          trafficPotential: "800–2000 посещений/мес",
          rationale: "Высокий коммерческий интент, конкуренты закрывают эту тему отдельными лендингами",
        },
        {
          topic: "Как выбрать семантическое ядро: инструменты и методология",
          suggestedSlug: "/blog/keyword-research-guide",
          priority: "medium",
          trafficPotential: "500–1500 посещений/мес",
          rationale: "Хорошо перелинковывается с основной темой, усиливает топикальный авторитет",
        },
        {
          topic: "Внутренняя перелинковка: стратегия и примеры",
          suggestedSlug: "/blog/internal-linking-strategy",
          priority: "medium",
          trafficPotential: "300–800 посещений/мес",
          rationale: "Тема присутствует у конкурентов, но плохо раскрыта — есть возможность занять топ с качественным материалом",
        },
        {
          topic: "Скорость сайта и Core Web Vitals: влияние на ранжирование",
          suggestedSlug: "/blog/core-web-vitals-seo",
          priority: "low",
          trafficPotential: "200–600 посещений/мес",
          rationale: "Актуальная тема после обновлений Google, поддерживает экспертный образ",
        },
      ],
    },
    costUsd: 0,
  };
}

// ─────────────────────────────────────────
// ГЕНЕРАЦИЯ ТЗ
// ─────────────────────────────────────────

const SITE_TYPE_CONTEXT: Record<SiteType, string> = {
  ecommerce: `ТИП САЙТА: Интернет-магазин / карточка товара или категория.
Фокус брифа: конверсионные элементы (цена, CTA, корзина), schema.org Product/Offer, фильтры, характеристики товара, доверительные сигналы (отзывы, гарантия, доставка), внутренняя перелинковка по каталогу.
НЕ рекомендуй длинные информационные тексты — для e-comm важны структурированность и конверсия.`,
  content: `ТИП САЙТА: Информационный сайт / блог / статья.
Фокус брифа: глубина и экспертность контента, E-E-A-T сигналы, FAQ для featured snippets, структура заголовков, внутренняя перелинковка по теме, автор и источники.`,
  local: `ТИП САЙТА: Локальный бизнес (офлайн-точка, услуги с адресом).
Фокус брифа: LocalBusiness schema, NAP (имя/адрес/телефон), карта и часы работы, отзывы с привязкой к местоположению, ключи с гео-уточнениями, Google Business Profile.`,
};

export async function generateSEOBrief(
  targetUrl: string,
  competitors: SerpResult[],
  keywords: KeywordData[],
  domainInfo: DomainInfo[] = [],
  analytics?: AnalyticsResult,
  gscRows: GscRow[] = [],
  siteType: SiteType = "content"
): Promise<{ brief: SEOBrief; costUsd: number }> {
  if (USE_MOCK) return getMockBrief(targetUrl, competitors);

  const domainMap = new Map(domainInfo.map((d) => [d.domain, d]));

  const competitorList = competitors
    .map((c) => {
      const di = domainMap.get(c.domain);
      const meta = di
        ? `   Возраст: ${di.domainAge ?? "н/д"} | Бэклинки: ${di.backlinks.toLocaleString()} | RD: ${di.referringDomains.toLocaleString()}`
        : "";
      return `${c.position}. ${c.title}\n   URL: ${c.url}\n   Snippet: ${c.snippet || "н/д"}${meta ? "\n" + meta : ""}`;
    })
    .join("\n\n");

  const keywordList = keywords
    .slice(0, 20)
    .map((k) => `- ${k.keyword}: объём ${k.volume}, CPC $${k.cpc}, конкуренция ${k.competition}`)
    .join("\n");

  // GSC-контекст для промпта
  let gscBlock = "";
  if (analytics && gscRows.length > 0) {
    const top3 = analytics.allKeywords
      .filter((k) => k.tag === "top3")
      .slice(0, 10)
      .map((k) => `- "${k.keyword}": позиция ${k.gscPosition?.toFixed(1)}, ${k.gscClicks} кликов/мес`)
      .join("\n");

    const quickWinsList = analytics.quickWins
      .slice(0, 10)
      .map((r) => `- "${r.query}": позиция ${r.position.toFixed(1)}, ${r.impressions} показов/мес, ${r.clicks} кликов`)
      .join("\n");

    const gapList = analytics.gapKeywords
      .slice(0, 15)
      .map((k) => `- "${k.keyword}" (volume: ${k.volume}, у ${k.occurrences} конкурентов в топе)`)
      .join("\n");

    gscBlock = `
ДАННЫЕ GOOGLE SEARCH CONSOLE:
Всего запросов в GSC: ${gscRows.length}, кликов: ${analytics.summary.gscTotalClicks.toLocaleString()}, показов: ${analytics.summary.gscTotalImpressions.toLocaleString()}

Уже в топ-4 (укрепить позиции):
${top3 || "нет данных"}

Quick Wins — позиции 5–20 (приоритет доработки):
${quickWinsList || "нет данных"}

Gap-ключи — конкуренты ранжируются, у нас нет:
${gapList || "нет данных"}

УЧТИ ЭТИ ДАННЫЕ В БРИФЕ: упомяни quick wins как приоритеты доработки, gap-ключи — как новые темы для охвата. Для top-3 ключей предложи как удержать и улучшить позиции.
`;
  }

  const prompt = `Ты — опытный SEO-специалист. На основе анализа конкурентов создай детальное ТЗ для копирайтера.

АНАЛИЗИРУЕМАЯ СТРАНИЦА: ${targetUrl}

${SITE_TYPE_CONTEXT[siteType]}

ТОП-10 КОНКУРЕНТОВ В ВЫДАЧЕ (с заголовками и сниппетами из поиска):
${competitorList}

КЛЮЧЕВЫЕ СЛОВА:
${keywordList}
${gscBlock}
Создай структурированное SEO ТЗ в формате JSON со следующими полями:

1. Основные SEO-параметры:
- targetKeyword: основной ключевой запрос
- recommendedTitle: рекомендуемый title (до 60 символов)
- recommendedMetaDescription: рекомендуемый meta description (до 155 символов)
- recommendedH1: рекомендуемый заголовок H1
- contentStructure: массив разделов [{title, content}] — структура статьи
- wordCountRecommendation: рекомендуемое кол-во слов
- topKeywordsToInclude: массив ключевых слов для включения в текст
- competitorInsights: краткий анализ конкурентов
- additionalRecommendations: массив дополнительных рекомендаций

2. E-E-A-T анализ (eeatAnalysis):
Проанализируй сниппеты и URL конкурентов на предмет сигналов Experience, Expertise, Authoritativeness, Trustworthiness.

eeatAnalysis должен содержать:
- experience: { score: 1-10, signals: string[], gaps: string[] }
  (Опыт: упоминания реальных кейсов, личных тестов, «мы проверили», конкретных результатов)
- expertise: { score: 1-10, signals: string[], gaps: string[] }
  (Экспертиза: биографии авторов, регалии, профессиональная терминология, ссылки на исследования)
- authoritativeness: { score: 1-10, signals: string[], gaps: string[] }
  (Авторитетность: упоминания в медиа, партнёрства, отраслевые награды, цитирование другими)
- trustworthiness: { score: 1-10, signals: string[], gaps: string[] }
  (Доверие: HTTPS, прозрачность методологии, дата обновления, контакты, источники)
- overallScore: средний балл (1-10)
- summary: краткий вывод об уровне E-E-A-T у конкурентов и возможностях для отстройки
- recommendations: массив конкретных рекомендаций для копирайтера как усилить E-E-A-T (5-7 пунктов)

3. Стратегия линкбилдинга (linkBuildingStrategy):
На основе возраста доменов, количества бэклинков и referring domains конкурентов сформируй рекомендации по наращиванию ссылочной массы.

linkBuildingStrategy должен содержать:
- summary: краткий анализ ссылочного профиля конкурентов и что нужно для конкуренции (2–3 предложения)
- targetDR: целевой диапазон DR/DA ссылающихся доменов (например "30–60")
- recommendations: массив из 3–5 объектов { type, description, priority: "high"|"medium"|"low", examples: string[] }
  (type — метод получения ссылок: гостевые посты, niche edits, HARO, цифровой PR и т.д.)
- anchorTextStrategy: рекомендация по анкорам (доли брендовых / общих / ключевых)

4. Контентные пробелы (contentGaps):
На основе URL и заголовков конкурентов выяви темы/страницы, которые присутствуют у нескольких конкурентов, но отсутствуют у анализируемого сайта.

contentGaps — массив из 4–6 объектов:
- topic: название темы/страницы (конкретное, для копирайтера)
- suggestedSlug: предлагаемый URL-slug страницы (например /blog/seo-audit-checklist)
- priority: "high" | "medium" | "low" (по потенциалу трафика и частоте у конкурентов)
- trafficPotential: примерная оценка трафика в месяц (например "500–2000 посещений/мес")
- rationale: 1–2 предложения почему эту страницу стоит создать

Отвечай ТОЛЬКО JSON, без markdown-обёртки.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";

  let brief: SEOBrief;
  try {
    brief = JSON.parse(responseText);
  } catch {
    throw new Error(`Claude вернул невалидный JSON: ${responseText.slice(0, 200)}`);
  }

  // Считаем стоимость: claude-sonnet-4-6 — $3/1M input, $15/1M output
  const inputCost = (message.usage.input_tokens / 1_000_000) * 3;
  const outputCost = (message.usage.output_tokens / 1_000_000) * 15;
  const costUsd = inputCost + outputCost;

  return { brief, costUsd };
}

// ─────────────────────────────────────────
// СРАВНЕНИЕ С КОНКУРЕНТАМИ
// ─────────────────────────────────────────

function snapshotText(s: PageSnapshot): string {
  return `URL: ${s.url}
Слов: ${s.wordCount}
Title: ${s.title}
H1: ${s.h1}
Meta description: ${s.metaDescription}
H2/H3 заголовки: ${s.headings.join(" | ") || "нет"}
Schema.org: ${s.hasSchema ? s.schemaTypes.join(", ") : "нет"}
Внутренних ссылок: ${s.internalLinksCount}
Изображений: ${s.imagesCount} (с alt: ${s.imagesWithAlt})${s.fetchError ? `\n[ОШИБКА ЗАГРУЗКИ: ${s.fetchError} — оценивай по доступным данным]` : ""}`;
}

export async function generateComparisons(
  targetSnapshot: PageSnapshot,
  competitorSnapshots: PageSnapshot[],
  competitors: SerpResult[]
): Promise<CompetitorComparison[]> {
  if (USE_MOCK) return getMockComparisons(competitorSnapshots.map((s, i) => competitors[i] ?? { position: i + 1, url: s.url, domain: "", title: "", snippet: "" }));

  const targetText = snapshotText(targetSnapshot);

  const comparisonsData = await Promise.all(
    competitorSnapshots.map(async (compSnap, idx) => {
      const comp = competitors[idx];
      if (!comp) return null;

      const compText = snapshotText(compSnap);

      const prompt = `Ты SEO-аналитик. Сравни две страницы и дай РОВНО 5 конкретных причин почему конкурент ранжируется выше.

СТРАНИЦА ПОЛЬЗОВАТЕЛЯ (позиция: не в топ-10 или ниже конкурента):
${targetText}

КОНКУРЕНТ (позиция #${comp.position}):
${compText}

Правила:
- Каждая причина должна называть КОНКРЕТНЫЕ цифры или факты из данных выше
- Не пиши общие советы — только то что видно из предоставленных данных
- Формат recommendation — конкретное действие, например: "Добавьте раздел X объёмом 300 слов"
- category: "content" | "structure" | "keywords" | "technical" | "eeat"
- impact: "high" | "medium" | "low"

Отвечай ТОЛЬКО JSON:
{
  "competitorUrl": "${comp.url}",
  "competitorPosition": ${comp.position},
  "summary": "одна строка — главный вывод о разрыве",
  "reasons": [
    { "category": "...", "finding": "У него X, у тебя Y", "recommendation": "Конкретное действие", "impact": "high" },
    ...5 штук...
  ]
}`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      });

      const text = message.content[0].type === "text" ? message.content[0].text : "";
      try {
        return JSON.parse(text) as CompetitorComparison;
      } catch {
        return null;
      }
    })
  );

  return comparisonsData.filter((c): c is CompetitorComparison => c !== null);
}

// ─────────────────────────────────────────
// ЧТО ПОЧИНИТЬ ЗА ВЫХОДНЫЕ
// ─────────────────────────────────────────

export async function generateQuickFixes(
  targetUrl: string,
  brief: SEOBrief,
  comparisons: CompetitorComparison[],
  analytics: AnalyticsResult,
  siteType: SiteType = "content"
): Promise<QuickFix[]> {
  if (USE_MOCK) return getMockQuickFixes(targetUrl);

  const topReasons = comparisons
    .flatMap((c) => c.reasons.filter((r) => r.impact === "high"))
    .slice(0, 6)
    .map((r) => `- ${r.finding} → ${r.recommendation}`)
    .join("\n");

  const quickWins = analytics.quickWins
    .slice(0, 5)
    .map((r) => `- "${r.query}": позиция ${r.position.toFixed(1)}, ${r.impressions} показов`)
    .join("\n");

  const siteTypeHint =
    siteType === "ecommerce"
      ? "Сайт — интернет-магазин. Приоритет: карточка товара, конверсия, schema Product, доставка/гарантия, отзывы, цены."
      : siteType === "local"
      ? "Сайт — локальный бизнес. Приоритет: адрес/контакты, LocalBusiness schema, отзывы с геопривязкой, ключи с городом."
      : "Сайт — информационный. Приоритет: структура текста, экспертность, FAQ, автор, внутренние ссылки.";

  const prompt = `Ты помощник для владельцев бизнеса. На основе SEO-анализа составь список из 3–5 конкретных задач которые владелец может сделать сам, прямо сейчас.

${siteTypeHint}

URL страницы: ${targetUrl}
Рекомендуемый title: ${brief.recommendedTitle}
Рекомендуемый H1: ${brief.recommendedH1}
Рекомендуемый meta description: ${brief.recommendedMetaDescription}

Главные проблемы по сравнению с конкурентами:
${topReasons || "Данных по сравнению нет"}

Quick wins из GSC (запросы на позициях 5–20):
${quickWins || "Данных нет"}

Правила:
- Никаких SEO-терминов (не "E-E-A-T", не "DR", не "семантическое ядро")
- Каждое действие — конкретное, с примером ("замените title на вот этот: ...")
- effort: "5min" (скопировать-вставить), "30min" (написать блок текста), "2hours" (большая правка)
- category: "meta" | "content" | "links" | "technical"
- Сортируй по impact: сначала самые быстрые и важные

Отвечай ТОЛЬКО JSON-массивом:
[
  {
    "action": "Конкретное действие с примером",
    "where": "URL или название места на сайте",
    "effort": "5min",
    "why": "Почему это важно, без терминов",
    "category": "meta"
  },
  ...3–5 штук...
]`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    return JSON.parse(text) as QuickFix[];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────
// МАТРИЦА БЛОКОВ
// ─────────────────────────────────────────


const BLOCK_LABELS_ECOMMERCE: Record<string, string> = {
  gallery:           "Фотогалерея товара",
  price:             "Цена + кнопка «Купить»",
  reviews:           "Отзывы покупателей",
  comparison_table:  "Таблица характеристик",
  social_proof:      "Счётчик продаж/покупателей",
  video:             "Видео-обзор товара",
  related_products:  "Похожие / рекомендуемые товары",
  delivery_info:     "Условия доставки",
  warranty:          "Гарантия и возврат",
  installment:       "Рассрочка / кредит",
  calculator:        "Конфигуратор / калькулятор",
  faq:               "Частые вопросы (FAQ)",
  chat:              "Онлайн-чат",
};

const BLOCK_LABELS_CONTENT: Record<string, string> = {
  faq:               "Частые вопросы (FAQ)",
  table_of_contents: "Оглавление / навигация",
  author_bio:        "Биография автора",
  video:             "Видео по теме",
  comparison_table:  "Таблица сравнения",
  infographic:       "Инфографика / схема",
  related_articles:  "Похожие статьи",
  social_proof:      "Счётчик читателей / поделились",
  form:              "Форма подписки / заявки",
};

const BLOCK_LABELS_LOCAL: Record<string, string> = {
  map:               "Карта и адрес",
  reviews:           "Отзывы с геопривязкой",
  price:             "Цены / прейскурант",
  working_hours:     "Часы работы",
  form:              "Форма заявки / обратный звонок",
  gallery:           "Фото объекта / работ",
  social_proof:      "Счётчик клиентов",
  faq:               "Частые вопросы",
  chat:              "Онлайн-чат / мессенджер",
};

// legacy — используется в getMockBlockMatrix
const BLOCK_LABELS = BLOCK_LABELS_ECOMMERCE;

function getMockBlockMatrix(competitorCount: number): BlockRow[] {
  return [
    {
      block: "Отзывы покупателей",
      yours: false,
      competitors: Array(competitorCount).fill(true),
      priority: "must",
      tip: "Добавьте блок с 5–10 реальными отзывами и средним рейтингом (★ 4.8). Это сигнал доверия — Google видит его через schema.org AggregateRating.",
    },
    {
      block: "Частые вопросы (FAQ)",
      yours: false,
      competitors: Array(competitorCount).fill(true).map((_, i) => i < 2),
      priority: "must",
      tip: "Добавьте 5–7 вопросов с ответами. Шанс попасть в блок «Люди также спрашивают» в поиске — это бесплатный трафик.",
    },
    {
      block: "Фотогалерея",
      yours: false,
      competitors: Array(competitorCount).fill(true),
      priority: "consider",
      tip: "Добавьте 8–12 фото товара с разных ракурсов. Страницы с галереей задерживают пользователя дольше, что улучшает позиции.",
    },
    {
      block: "Счётчик клиентов/продаж",
      yours: false,
      competitors: Array(competitorCount).fill(true).map((_, i) => i < 2),
      priority: "consider",
      tip: 'Добавьте строку "Уже купили 3 400 покупателей" или "В корзине у 12 человек". Повышает конверсию и время на странице.',
    },
    {
      block: "Видео-обзор",
      yours: false,
      competitors: [true, ...Array(Math.max(competitorCount - 1, 0)).fill(false)],
      priority: "optional",
      tip: "Короткое видео (1–2 мин) с обзором товара. Страницы с видео держат пользователей на 2–3 минуты дольше.",
    },
    {
      block: "Форма заявки / обратная связь",
      yours: true,
      competitors: Array(competitorCount).fill(true),
      priority: "must",
      tip: "Уже есть — хорошо.",
    },
    {
      block: "Цены / прайс",
      yours: true,
      competitors: Array(competitorCount).fill(true),
      priority: "must",
      tip: "Уже есть — хорошо.",
    },
  ];
}

export async function generateBlockMatrix(
  targetSnapshot: PageSnapshot,
  competitorSnapshots: PageSnapshot[],
  competitors: SerpResult[],
  siteType: SiteType = "content"
): Promise<BlockRow[]> {
  if (USE_MOCK) return getMockBlockMatrix(competitorSnapshots.length);

  const blockLabels =
    siteType === "ecommerce" ? BLOCK_LABELS_ECOMMERCE :
    siteType === "local"     ? BLOCK_LABELS_LOCAL :
                               BLOCK_LABELS_CONTENT;
  const allKnownBlocks = Object.keys(blockLabels);

  const formatPage = (snap: PageSnapshot, label: string) =>
    `${label}:
  Заголовки: ${snap.headings.join(" | ") || "нет"}
  Эвристически найденные блоки: ${snap.detectedBlocks.join(", ") || "не найдено"}
  Schema.org: ${snap.schemaTypes.join(", ") || "нет"}
  Слов: ${snap.wordCount}`;

  const pagesText = [
    formatPage(targetSnapshot, "ВАША СТРАНИЦА"),
    ...competitorSnapshots.map((s, i) =>
      formatPage(s, `КОНКУРЕНТ #${competitors[i]?.position ?? i + 1} (${competitors[i]?.domain ?? ""})`)
    ),
  ].join("\n\n");

  const siteTypeLabel =
    siteType === "ecommerce" ? "Интернет-магазин" :
    siteType === "local"     ? "Локальный бизнес" :
                               "Информационный сайт";

  const prompt = `Ты SEO-аналитик. Проанализируй страницы и составь матрицу контентных блоков.

ТИП САЙТА: ${siteTypeLabel}

${pagesText}

Список блоков для анализа (можешь добавить свои если видишь в заголовках):
${allKnownBlocks.map((k) => `- ${k}: ${blockLabels[k]}`).join("\n")}

Задача:
1. Для каждого блока определи: есть ли он на каждой странице (используй эвристику + заголовки как подсказку)
2. Рассчитай приоритет: "must" = у большинства конкурентов есть, у нас нет; "consider" = у части конкурентов; "optional" = у одного или у всех уже есть
3. Для отсутствующих у нас — напиши конкретный tip без SEO-жаргона

Включай только блоки которые реально имеют значение (не включай банальное типа "логотип").
Сортируй: сначала "must", потом "consider", потом "optional" (включая те что уже есть).

Отвечай ТОЛЬКО JSON-массивом (${competitorSnapshots.length} конкурентов = ${competitorSnapshots.length} элементов в "competitors"):
[
  {
    "block": "Название блока на русском",
    "yours": true/false,
    "competitors": [true/false, ...],
    "priority": "must",
    "tip": "Конкретно что добавить и зачем, без терминов"
  }
]`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    return JSON.parse(text) as BlockRow[];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────
// ГОТОВЫЙ КОНТЕНТ ДЛЯ КОПИПАСТА (Pro)
// ─────────────────────────────────────────

function getMockReadyContent(targetUrl: string, brief: SEOBrief): ReadyContent {
  const domain = (() => { try { return new URL(targetUrl).hostname; } catch { return targetUrl; } })();
  return {
    title: brief.recommendedTitle,
    h1: brief.recommendedH1,
    metaDescription: brief.recommendedMetaDescription,
    introParagraph: `Если вы ищете ${brief.targetKeyword} — вы попали по адресу. На ${domain} мы собрали всё что нужно: подробные характеристики, реальные отзывы покупателей и честные цены. Ниже — полный обзор который поможет сделать правильный выбор без лишней траты времени.`,
    faqItems: [
      { question: `Как выбрать ${brief.targetKeyword}?`, answer: `При выборе обратите внимание на три ключевых параметра: качество материалов, соответствие вашим задачам и репутацию производителя. Мы рекомендуем сначала определить бюджет, затем сравнить характеристики в нашем каталоге.` },
      { question: `Сколько стоит ${brief.targetKeyword}?`, answer: `Цена зависит от комплектации и производителя. В нашем каталоге представлены варианты в разных ценовых категориях — от бюджетных до премиум. Актуальные цены всегда указаны на странице товара.` },
      { question: `Какие гарантии вы предоставляете?`, answer: `На все товары распространяется официальная гарантия производителя. Дополнительно мы предлагаем собственную гарантию качества: если товар не подойдёт, вернём деньги в течение 14 дней.` },
      { question: `Как быстро осуществляется доставка?`, answer: `Доставка по Москве — 1–2 рабочих дня, по России — 3–7 дней в зависимости от региона. Самовывоз из нашего шоурума доступен в день заказа.` },
      { question: `Можно ли посмотреть товар вживую?`, answer: `Да, все представленные модели можно увидеть в нашем шоуруме. Адрес и часы работы указаны в разделе «Контакты». Рекомендуем записаться заранее чтобы менеджер уделил вам время.` },
    ],
    schemaMarkup: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": `Как выбрать ${brief.targetKeyword}?`, "acceptedAnswer": { "@type": "Answer", "text": "При выборе обратите внимание на качество материалов, соответствие задачам и репутацию производителя." } },
        { "@type": "Question", "name": `Сколько стоит ${brief.targetKeyword}?`, "acceptedAnswer": { "@type": "Answer", "text": "Цена зависит от комплектации и производителя. Актуальные цены указаны на странице товара." } },
      ],
    }, null, 2),
  };
}

export async function generateReadyContent(
  targetUrl: string,
  brief: SEOBrief,
  siteType: SiteType = "content"
): Promise<ReadyContent> {
  if (USE_MOCK) return getMockReadyContent(targetUrl, brief);

  const schemaType =
    siteType === "ecommerce" ? "Product + Offer" :
    siteType === "local"     ? "LocalBusiness" :
                               "Article + FAQPage";

  const prompt = `Ты SEO-копирайтер. Создай готовый контент для страницы — всё что можно сразу скопировать и вставить на сайт.

URL: ${targetUrl}
Тип сайта: ${siteType === "ecommerce" ? "Интернет-магазин" : siteType === "local" ? "Локальный бизнес" : "Информационный сайт"}
Целевой ключ: ${brief.targetKeyword}
Рекомендации из брифа:
- Title: ${brief.recommendedTitle}
- H1: ${brief.recommendedH1}
- Meta: ${brief.recommendedMetaDescription}
- Объём: ${brief.wordCountRecommendation} слов
- Ключи для включения: ${brief.topKeywordsToInclude.slice(0, 8).join(", ")}

Правила:
- title: строго до 60 символов, содержит ключ, без кликбейта
- h1: до 70 символов, естественный язык
- metaDescription: до 155 символов, продающий, с призывом
- introParagraph: 100–150 слов, ключ в первом предложении, отвечает на запрос, без воды
- faqItems: ровно 5 реальных вопросов. Ответ 50–80 слов, конкретный
- schemaMarkup: валидный JSON-LD для ${schemaType}, готовый для вставки в <script type="application/ld+json">

Отвечай ТОЛЬКО JSON:
{
  "title": "...",
  "h1": "...",
  "metaDescription": "...",
  "introParagraph": "...",
  "faqItems": [
    { "question": "...", "answer": "..." }
  ],
  "schemaMarkup": "...строка с JSON-LD..."
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    return JSON.parse(text) as ReadyContent;
  } catch {
    return getMockReadyContent(targetUrl, brief);
  }
}

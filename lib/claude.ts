// Клиент для Claude API (Anthropic)
// Генерирует SEO ТЗ на основе данных о конкурентах и ключевых словах
// Если ANTHROPIC_API_KEY не задан — возвращает мок-данные для разработки
import Anthropic from "@anthropic-ai/sdk";
import type { SerpResult, KeywordData, DomainInfo } from "./dataforseo";
import type { AnalyticsResult } from "./analytics";
import type { GscRow } from "./gsc";

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

export interface ClaudeResult {
  brief: SEOBrief;
  // Стоимость в USD: входящие токены дороже исходящих
  costUsd: number;
}

// ─────────────────────────────────────────
// МОК — возвращается когда нет API ключа
// ─────────────────────────────────────────

function getMockBrief(targetUrl: string, competitors: SerpResult[]): ClaudeResult {
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

export async function generateSEOBrief(
  targetUrl: string,
  competitors: SerpResult[],
  keywords: KeywordData[],
  domainInfo: DomainInfo[] = [],
  analytics?: AnalyticsResult,
  gscRows: GscRow[] = []
): Promise<ClaudeResult> {
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

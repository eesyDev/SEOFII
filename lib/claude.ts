// Клиент для Claude API (Anthropic)
// Генерирует SEO ТЗ на основе данных о конкурентах и ключевых словах
// Если ANTHROPIC_API_KEY не задан — возвращает мок-данные для разработки
import Anthropic from "@anthropic-ai/sdk";
import type { SerpResult, KeywordData } from "./dataforseo";

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
  keywords: KeywordData[]
): Promise<ClaudeResult> {
  if (USE_MOCK) return getMockBrief(targetUrl, competitors);

  const competitorList = competitors
    .map((c) => `${c.position}. ${c.title}\n   URL: ${c.url}\n   Snippet: ${c.snippet || "н/д"}`)
    .join("\n\n");

  const keywordList = keywords
    .slice(0, 20)
    .map((k) => `- ${k.keyword}: объём ${k.volume}, CPC $${k.cpc}, конкуренция ${k.competition}`)
    .join("\n");

  const prompt = `Ты — опытный SEO-специалист. На основе анализа конкурентов создай детальное ТЗ для копирайтера.

АНАЛИЗИРУЕМАЯ СТРАНИЦА: ${targetUrl}

ТОП-10 КОНКУРЕНТОВ В ВЫДАЧЕ (с заголовками и сниппетами из поиска):
${competitorList}

КЛЮЧЕВЫЕ СЛОВА:
${keywordList}

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

Отвечай ТОЛЬКО JSON, без markdown-обёртки.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
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

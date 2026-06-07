import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/**
 * CLI-скрипт для добычи нишевых паттернов.
 *
 * Запуск:
 *   npx tsx scripts/mineNiche.ts <niche_slug> "<seed_query_1>" "<seed_query_2>" ...
 *
 * Пример:
 *   npx tsx scripts/mineNiche.ts construction_repair "ремонт квартир москва" "отделка квартир под ключ"
 */

import { prisma } from "../lib/prisma";
import { fetchSerpResults, fetchYandexSerpResults, isAggregatorDomain, YANDEX_LOCATIONS } from "../lib/dataforseo";
import { scrapePages } from "../lib/scraper";
import { htmlToMiningMarkdown } from "../lib/markdownClean";
import { minePatternsFromNiche, savePatternsToDb } from "../lib/nicheMining";
import type { CleanedPage } from "../lib/markdownClean";

// По умолчанию Казахстан (русскоязычная выдача).
// Для других стран передай --location=US вторым аргументом после slug
const LOCATION_MAP: Record<string, number> = {
  US: 2840, UK: 2826, DE: 2276, FR: 2250, KZ: 2398, UA: 2804,
};
const DEFAULT_LOCATION = 2398;

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(`
Использование:
  npx tsx scripts/mineNiche.ts <niche_slug> "<query1>" "<query2>" ...

Пример:
  npx tsx scripts/mineNiche.ts construction_repair "ремонт квартир москва" "отделка квартир под ключ" "евроремонт"
`);
    process.exit(1);
  }

  const locationArg = args.find((a) => a.startsWith("--location="));
  const sourceArg = args.find((a) => a.startsWith("--source="));
  const cityArg = args.find((a) => a.startsWith("--city="));

  const source = sourceArg?.split("=")[1] ?? "google";
  const locationCode = locationArg
    ? (LOCATION_MAP[locationArg.split("=")[1].toUpperCase()] ?? DEFAULT_LOCATION)
    : DEFAULT_LOCATION;
  const yandexCity = cityArg?.split("=")[1].toUpperCase() ?? "MOSCOW";
  const yandexLocationCode = YANDEX_LOCATIONS[yandexCity]?.code ?? YANDEX_LOCATIONS.MOSCOW.code;

  const PAGE_TYPES = ["home", "service", "portfolio", "price", "article"];
  const niche = args[0];
  const secondArg = args[1];
  // Если второй аргумент — тип страницы, а не запрос
  const pageType = PAGE_TYPES.includes(secondArg) ? secondArg : "home";
  const queryStartIdx = PAGE_TYPES.includes(secondArg) ? 2 : 1;
  const seedQueries = args.slice(queryStartIdx).filter((a) => !a.startsWith("--"));

  const sourceLabel = source === "yandex"
    ? `Яндекс (${YANDEX_LOCATIONS[yandexCity]?.label ?? yandexCity})`
    : `Google (location: ${locationCode})`;

  console.log(`🚀 Начинаем добычу паттернов для ниши: "${niche}" / тип: "${pageType}"`);
  console.log(`🌐 Источник: ${sourceLabel}`);
  console.log(`📋 Seed-запросы (${seedQueries.length}): ${seedQueries.join(", ")}`);
  console.log("");

  // 1. Собираем URL конкурентов из всех seed-запросов
  const allUrls = new Set<string>();
  const urlToQuery = new Map<string, string>();

  for (const query of seedQueries) {
    console.log(`🔍 SERP для: "${query}"`);
    try {
      const competitors = source === "yandex"
        ? await fetchYandexSerpResults(query, yandexLocationCode)
        : await fetchSerpResults(query, locationCode);
      for (const c of competitors) {
        if (!isAggregatorDomain(c.url)) {
          allUrls.add(c.url);
          urlToQuery.set(c.url, query);
        }
      }
      console.log(`   Найдено ${competitors.length} конкурентов`);
    } catch (err) {
      console.error(`   ❌ Ошибка: ${err instanceof Error ? err.message : err}`);
    }
  }

  const uniqueUrls = [...allUrls];
  console.log(`\n📊 Уникальных URL после дедупликации: ${uniqueUrls.length}`);

  if (uniqueUrls.length === 0) {
    console.error("❌ Не найдено ни одного URL для анализа. Проверь запросы и API-ключи.");
    process.exit(1);
  }

  // 2. Скрапим страницы (один fetch — HTML сохраняется в snapshot.rawHtml)
  console.log("\n🕷️ Скрапим страницы...");
  const { competitors: snapshots } = await scrapePages("https://example.com", uniqueUrls);

  const successfulSnapshots = snapshots.filter((s) => !s.fetchError && s.rawHtml);
  const failedSnapshots = snapshots.filter((s) => s.fetchError || !s.rawHtml);

  console.log(`   ✅ Успешно: ${successfulSnapshots.length}`);
  console.log(`   ❌ Ошибки: ${failedSnapshots.length}`);

  if (failedSnapshots.length > 0) {
    for (const s of failedSnapshots.slice(0, 3)) {
      console.log(`      - ${s.url}: ${s.fetchError ?? "no HTML"}`);
    }
  }

  // 3. Конвертируем в Markdown (используем уже скачанный HTML)
  console.log("\n🧹 Очищаем HTML → Markdown...");
  const cleanedPages: CleanedPage[] = [];

  for (const snap of successfulSnapshots) {
    if (!snap.rawHtml) continue;
    try {
      const cleaned = htmlToMiningMarkdown(snap.rawHtml, snap.url);
      cleanedPages.push(cleaned);
    } catch {
      // игнорируем ошибки парсинга отдельных страниц
    }
  }

  console.log(`   Готово: ${cleanedPages.length} страниц для анализа`);

  if (cleanedPages.length === 0) {
    console.error("❌ Не удалось получить ни одной страницы для анализа.");
    process.exit(1);
  }

  // 4. Отправляем в Gemini Flash
  console.log("\n🤖 Анализируем паттерны через Gemini Flash...");
  const result = await minePatternsFromNiche(niche, cleanedPages);

  console.log(`   🔍 Проанализировано доменов: ${result.analyzedDomains.join(", ")}`);
  console.log(`   📦 Найдено паттернов: ${result.patterns.length}`);
  console.log(`   🗑️ Отклонено (шум): ${result.rejected?.join(", ") || "нет"}`);

  if (result.patterns.length === 0) {
    console.log("\n⚠️ Gemini не нашёл повторяющихся паттернов. Попробуй другие seed-запросы.");
    process.exit(0);
  }

  // 5. Показываем результат перед сохранением
  console.log("\n📋 Найденные паттерны (pending):");
  for (const p of result.patterns) {
    console.log(`   • ${p.label} (${p.name}) — freq: ${(p.frequency * 100).toFixed(0)}%, type: ${p.blockType}`);
    console.log(`     ${p.rationale}`);
  }

  // 6. Сохраняем в БД
  console.log("\n💾 Сохраняем в базу...");
  const savedCount = await savePatternsToDb(niche, result, pageType);
  console.log(`   ✅ Сохранено ${savedCount} паттернов со статусом "pending"`);

  console.log("\n🏁 Готово! Проверь результаты в Prisma Studio:");
  console.log(`   npx prisma studio → NichePattern ( niche = "${niche}" )`);
  console.log("\n💡 Чтобы одобрить паттерны — обнови confidence: 'pending' → 'approved'");
}

main()
  .catch((err) => {
    console.error("\n💥 Фатальная ошибка:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

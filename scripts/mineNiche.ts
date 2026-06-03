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
import { fetchCompetitors } from "../lib/dataforseo";
import { scrapePages } from "../lib/scraper";
import { htmlToMiningMarkdown, isAggregator } from "../lib/markdownClean";
import { minePatternsFromNiche, savePatternsToDb } from "../lib/nicheMining";
import type { CleanedPage } from "../lib/markdownClean";

const LOCATION_CODE = 2840; // Россия по умолчанию, можно сделать флаг

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

  const niche = args[0];
  const seedQueries = args.slice(1);

  console.log(`🚀 Начинаем добычу паттернов для ниши: "${niche}"`);
  console.log(`📋 Seed-запросы (${seedQueries.length}): ${seedQueries.join(", ")}`);
  console.log("");

  // 1. Собираем URL конкурентов из всех seed-запросов
  const allUrls = new Set<string>();
  const urlToQuery = new Map<string, string>();

  for (const query of seedQueries) {
    console.log(`🔍 SERP для: "${query}"`);
    try {
      // Передаём фиктивный URL, так как fetchCompetitors требует его для фильтрации
      const competitors = await fetchCompetitors("https://example.com", LOCATION_CODE, query);
      for (const c of competitors) {
        if (!isAggregator(c.url)) {
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

  // 2. Скрапим страницы
  console.log("\n🕷️ Скрапим страницы...");
  const { competitors: snapshots } = await scrapePages("https://example.com", uniqueUrls);

  const successfulSnapshots = snapshots.filter((s) => !s.fetchError);
  const failedSnapshots = snapshots.filter((s) => s.fetchError);

  console.log(`   ✅ Успешно: ${successfulSnapshots.length}`);
  console.log(`   ❌ Ошибки: ${failedSnapshots.length}`);

  if (failedSnapshots.length > 0) {
    for (const s of failedSnapshots.slice(0, 3)) {
      console.log(`      - ${s.url}: ${s.fetchError}`);
    }
  }

  // 3. Конвертируем в Markdown
  console.log("\n🧹 Очищаем HTML → Markdown...");
  const cleanedPages: CleanedPage[] = [];

  for (const snap of successfulSnapshots) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(snap.url, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", Accept: "text/html" },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (!res.ok) continue;
      const html = await res.text();
      const cleaned = htmlToMiningMarkdown(html, snap.url);
      cleanedPages.push(cleaned);
    } catch {
      // игнорируем ошибки повторной загрузки
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
  console.log(`   🗑️ Отклонено (шум): ${result.rejected.join(", ") || "нет"}`);

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
  const savedCount = await savePatternsToDb(niche, result);
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

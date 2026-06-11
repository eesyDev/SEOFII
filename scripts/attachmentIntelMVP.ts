// MVP скрипт для тестирования AttachmentIntel на боссе
// Запуск: npx tsx scripts/attachmentIntelMVP.ts

import { scrapePages } from "@/lib/scraper";

const COMPETITORS = [
  // ЗАПОЛНИ URL конкурентов босса
  // "https://competitor1.com",
  // "https://competitor2.com",
  // "https://competitor3.com",
  // "https://competitor4.com",
  // "https://competitor5.com",
];

async function analyzeCompetitor(url: string) {
  console.log(`\n========== ${url} ==========`);
  
  try {
    const { target } = await scrapePages(url, []);
    
    console.log("Title:", target.title);
    console.log("Meta:", target.metaDescription);
    console.log("H1:", target.h1);
    console.log("Word count:", target.wordCount);
    console.log("Headings:", target.headings.length, target.headings.slice(0, 5));
    console.log("Blocks detected:", target.detectedBlocks);
    console.log("Schema:", target.schemaTypes);
    console.log("Internal links:", target.internalLinksCount);
    console.log("Images:", target.imagesCount);
    
    // Простая эвристика для поиска цен в тексте
    const priceMatches = target.rawHtml.match(/\$[\d,]+\.?\d*|\d+\.?\d*\s*(USD|\$)/gi) || [];
    const uniquePrices = [...new Set(priceMatches)].slice(0, 10);
    if (uniquePrices.length > 0) {
      console.log("Prices found:", uniquePrices.join(", "));
    }
    
    // Поиск promotions
    const promoKeywords = ["free shipping", "warranty", "financing", "discount", "sale", "special offer", "bulk pricing"];
    const foundPromos = promoKeywords.filter(kw => 
      target.rawHtml.toLowerCase().includes(kw)
    );
    if (foundPromos.length > 0) {
      console.log("Promotions:", foundPromos.join(", "));
    }
    
  } catch (err) {
    console.error("Failed to scrape:", err instanceof Error ? err.message : err);
  }
}

async function main() {
  if (COMPETITORS.length === 0 || COMPETITORS[0].startsWith("//")) {
    console.log("❌ ЗАПОЛНИ МАССИВ COMPETITORS в начале файла!");
    console.log("Добавь 5 URL конкурентов босса и запусти снова.");
    process.exit(1);
  }
  
  console.log("🚀 AttachmentIntel MVP Test");
  console.log(`📊 Анализируем ${COMPETITORS.length} конкурентов...\n`);
  
  for (const url of COMPETITORS) {
    await analyzeCompetitor(url);
  }
  
  console.log("\n✅ Готово! Скопируй вывод и сделай отчёт для босса.");
}

main();

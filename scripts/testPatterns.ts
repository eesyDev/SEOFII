import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { getPatternInsights } from "../lib/nichePatterns";

async function main() {
  // Тест: как если бы на странице были эти блоки
  const existingBlocks = ["Форма заявки", "FAQ", "Отзывы"];
  const siteType = "local";

  const patterns = await getPatternInsights(existingBlocks, siteType);

  console.log(`Найдено паттернов: ${patterns.length}`);
  console.log("Missing:", patterns.filter((p) => !p.present).map((p) => p.label));
  console.log("Present:", patterns.filter((p) => p.present).map((p) => p.label));
}

main().catch(console.error);

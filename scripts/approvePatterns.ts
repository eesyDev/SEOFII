/**
 * Bulk approve all pending patterns for a niche
 * Usage: npx tsx scripts/approvePatterns.ts <niche>
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const niche = process.argv[2];
  if (!niche) {
    console.error("Usage: npx tsx scripts/approvePatterns.ts <niche>");
    process.exit(1);
  }

  const result = await prisma.nichePattern.updateMany({
    where: { niche, confidence: "pending" },
    data: { confidence: "approved" },
  });

  console.log(`✅ Approved ${result.count} patterns for niche "${niche}"`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const report = await prisma.report.findUnique({
    where: { id: "cmq2kednb001eov64my5qn749" },
    select: { url: true, result: true },
  });
  
  const r = report?.result as any;
  
  console.log("=== BRIEF ===");
  console.log("targetKeyword:", r?.brief?.targetKeyword);
  console.log("recommendedTitle:", r?.brief?.recommendedTitle);
  console.log("recommendedH1:", r?.brief?.recommendedH1);
  console.log("wordCount:", r?.brief?.wordCountRecommendation);
  console.log("\ntopKeywords:", r?.brief?.topKeywordsToInclude?.slice(0, 10));
  
  console.log("\n=== CONTENT STRUCTURE ===");
  r?.brief?.contentStructure?.forEach((s: any) => console.log(`- ${s.title}: ${s.content?.slice(0, 100)}`));
  
  console.log("\n=== ADDITIONAL RECOMMENDATIONS ===");
  r?.brief?.additionalRecommendations?.forEach((rec: any) => console.log(`- ${rec}`));
  
  console.log("\n=== QUICK FIXES ===");
  r?.quickFixes?.forEach((f: any) => console.log(`[${f.effort}] ${f.action} | ${f.why}`));
  
  console.log("\n=== CONTENT GAPS ===");
  r?.brief?.contentGaps?.forEach((g: any) => console.log(`- ${g.topic} (${g.priority}): ${g.rationale?.slice(0, 100)}`));
  
  console.log("\n=== NICHE PATTERNS ===");
  r?.nichePatterns?.forEach((p: any) => console.log(`- ${p.label} freq:${p.frequency} present:${p.present}`));
  
  console.log("\n=== EEAT ===");
  console.log("overall:", r?.brief?.eeatAnalysis?.overallScore);
  console.log("summary:", r?.brief?.eeatAnalysis?.summary?.slice(0, 200));
  
  await prisma.$disconnect();
}

main().catch(console.error);

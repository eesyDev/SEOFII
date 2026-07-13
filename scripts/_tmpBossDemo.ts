import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma";
import { processReport } from "../lib/processReport";

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "khasanova.rano@gmail.com" } });
  const report = await prisma.report.create({
    data: { userId: user!.id, url: "https://www.bulwarkpest.com/", status: "PENDING", locationCode: 2840, language: "en" },
  });
  console.log("REPORT ID:", report.id);
  await processReport(report.id);
  const token = randomBytes(16).toString("hex");
  const done = await prisma.report.update({
    where: { id: report.id },
    data: { shareToken: token },
    select: { status: true, result: true },
  });
  const res = done.result as any;
  console.log("STATUS:", done.status);
  console.log("comparisons:", res?.comparisons?.length, "| evidence:", res?.competitorEvidence?.length, "| relevance:", res?.semanticAnalysis?.relevance?.pageScore);
  console.log("quickFix[0]:", res?.quickFixes?.[0]?.action?.slice(0, 90));
  console.log("SHARE URL: https://seobrief.vercel.app/en/reports/" + report.id + "?share=" + token);
}
main().catch((e) => { console.error("FAILED:", e?.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());

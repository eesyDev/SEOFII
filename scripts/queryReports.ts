import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const reports = await prisma.report.findMany({
    where: { status: "DONE" },
    select: { id: true, url: true, createdAt: true, costUsd: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log(JSON.stringify(reports, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);

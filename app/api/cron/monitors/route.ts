// Vercel Cron: еженедельный мониторинг страниц + вотчи конкурентов
import { NextRequest, NextResponse } from "next/server";
import { runPageMonitors, runCompetitorWatches } from "@/lib/cronJobs";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Делим бюджет функции между двумя задачами
  const pages = await runPageMonitors(140_000);
  const watches = await runCompetitorWatches(120_000);
  console.log("[cron/monitors]", JSON.stringify({ pages, watches }));
  return NextResponse.json({ pages, watches });
}

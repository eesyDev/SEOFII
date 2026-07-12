// Vercel Cron: плановые прогоны автопилота + замер позиций «после» для применённых правок
import { NextRequest, NextResponse } from "next/server";
import { runScheduledAutopilots, updateAutopilotOutcomes } from "@/lib/cronJobs";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const outcomes = await updateAutopilotOutcomes();
  const autopilot = await runScheduledAutopilots(200_000);
  console.log("[cron/autopilot]", JSON.stringify({ outcomes, autopilot }));
  return NextResponse.json({ outcomes, autopilot });
}

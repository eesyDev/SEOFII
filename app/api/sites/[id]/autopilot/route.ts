import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAutopilotJob } from "@/lib/autopilot";

interface Params {
  params: Promise<{ id: string }>;
}

// Анализ до 10 страниц с AI-вызовами — дольше дефолтного лимита функции
export const maxDuration = 300;

// POST /api/sites/[id]/autopilot — run autopilot analysis
export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const site = await prisma.siteConnection.findFirst({
    where: { id, userId: session.user.id },
    include: { config: true },
  });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  if (!site.config?.isEnabled) {
    return NextResponse.json({ error: "Autopilot is disabled for this site" }, { status: 400 });
  }

  try {
    const job = await createAutopilotJob(id);
    return NextResponse.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Autopilot failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/sites/[id]/autopilot — get latest autopilot jobs
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const site = await prisma.siteConnection.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const jobs = await prisma.autoPilotJob.findMany({
    where: { siteId: id },
    include: { changes: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ jobs });
}

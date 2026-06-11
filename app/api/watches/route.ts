import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scrapeCompetitorPage } from "@/lib/competitorWatch";

// GET /api/watches — list all competitor watches with latest snapshot + unread alert count
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const watches = await prisma.competitorWatch.findMany({
    where: { userId: session.user.id, isActive: true },
    include: {
      snapshots: {
        orderBy: { takenAt: "desc" },
        take: 1,
      },
      alerts: {
        where: { isRead: false },
        orderBy: { detectedAt: "desc" },
        take: 5,
      },
      _count: {
        select: { alerts: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ watches });
}

// POST /api/watches — add a new competitor watch + take initial snapshot
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { url, label, projectId } = body;

  if (!url || !label) {
    return NextResponse.json({ error: "url and label are required" }, { status: 400 });
  }

  let parsedUrl: string;
  try {
    parsedUrl = new URL(url).href;
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const watch = await prisma.competitorWatch.create({
    data: {
      userId: session.user.id,
      projectId: projectId || null,
      label,
      url: parsedUrl,
    },
  });

  // Take initial snapshot immediately (so we have baseline for future diffs)
  try {
    const snapshot = await scrapeCompetitorPage(parsedUrl);
    await prisma.competitorSnapshot.create({
      data: {
        watchId: watch.id,
        title: snapshot.title,
        wordCount: snapshot.wordCount,
        headings: snapshot.headings,
        blocks: snapshot.blocks,
        contentHash: snapshot.contentHash,
        rawText: snapshot.rawText,
      },
    });
  } catch (err) {
    // Don't fail watch creation if scrape fails — will retry on next cron run
    console.error(`Initial snapshot failed for ${parsedUrl}:`, err);
  }

  const result = await prisma.competitorWatch.findUnique({
    where: { id: watch.id },
    include: {
      snapshots: { orderBy: { takenAt: "desc" }, take: 1 },
      alerts: { where: { isRead: false }, take: 5 },
      _count: { select: { alerts: true } },
    },
  });

  return NextResponse.json({ watch: result }, { status: 201 });
}

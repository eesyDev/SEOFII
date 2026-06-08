import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { id: reportId } = await params;

  const report = await prisma.report.findUnique({
    where: { id: reportId, userId: session.user.id },
    select: { id: true, url: true, userId: true },
  });

  if (!report) return NextResponse.json({ error: "Не найден" }, { status: 404 });

  const monitor = await prisma.pageMonitor.findFirst({
    where: { reportId },
    include: {
      changes: {
        orderBy: { detectedAt: "desc" },
        take: 20,
      },
      outcomes: {
        orderBy: { delta: "asc" },
        take: 30,
      },
    },
  });

  if (!monitor) {
    return NextResponse.json({ isActive: false, changes: [], outcomes: [] });
  }

  return NextResponse.json({
    isActive: monitor.isActive,
    changes: monitor.changes,
    outcomes: monitor.outcomes,
  });
}

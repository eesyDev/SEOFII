import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WatchesClient from "@/components/watches/WatchesClient";

export default async function WatchesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const rawWatches = await prisma.competitorWatch.findMany({
    where: { userId: session.user.id, isActive: true },
    include: {
      snapshots: { orderBy: { takenAt: "desc" }, take: 1 },
      alerts: {
        orderBy: { detectedAt: "desc" },
        take: 10,
      },
      _count: { select: { alerts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Serialize dates for client component
  const watches = rawWatches.map((w) => ({
    id: w.id,
    label: w.label,
    url: w.url,
    createdAt: w.createdAt.toISOString(),
    snapshots: w.snapshots.map((s) => ({
      id: s.id,
      takenAt: s.takenAt.toISOString(),
      wordCount: s.wordCount,
      title: s.title,
    })),
    alerts: w.alerts.map((a) => ({
      id: a.id,
      changeType: a.changeType,
      summary: a.summary,
      detectedAt: a.detectedAt.toISOString(),
      isRead: a.isRead,
      diff: a.diff as Record<string, { before: string | number; after: string | number }> | undefined,
    })),
    _count: w._count,
  }));

  return <WatchesClient initialWatches={watches} />;
}

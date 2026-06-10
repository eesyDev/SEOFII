import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await prisma.autoPilotJob.findMany({
    where: { site: { userId: session.user.id } },
    include: {
      site: { select: { url: true, type: true } },
      changes: { select: { id: true, status: true, field: true, pageUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ jobs });
}

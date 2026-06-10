import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await prisma.autoPilotJob.findFirst({
    where: {
      id,
      site: { userId: session.user.id },
    },
    include: {
      site: { select: { url: true, type: true } },
      changes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({ job });
}

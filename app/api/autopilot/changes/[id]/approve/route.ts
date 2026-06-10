import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyChange } from "@/lib/autopilot";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const change = await prisma.autoPilotChange.findFirst({
    where: {
      id,
      job: { site: { userId: session.user.id } },
    },
    include: { job: { include: { site: { include: { config: true } } } } },
  });

  if (!change) return NextResponse.json({ error: "Change not found" }, { status: 404 });

  await prisma.autoPilotChange.update({
    where: { id },
    data: { status: "APPROVED" },
  });

  const config = change.job.site.config;
  const shouldAutoApply =
    (change.field === "title" && config?.autoApproveMeta) ||
    (change.field === "meta_description" && config?.autoApproveMeta);

  if (shouldAutoApply) {
    try {
      await applyChange(id);
      return NextResponse.json({ success: true, autoApplied: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Auto-apply failed";
      return NextResponse.json({ success: true, approved: true, autoApplied: false, error: message });
    }
  }

  return NextResponse.json({ success: true, approved: true, autoApplied: false });
}

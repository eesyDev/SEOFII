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
  });

  if (!change) return NextResponse.json({ error: "Change not found" }, { status: 404 });

  try {
    await applyChange(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Apply failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/watches/[id] — soft-delete (deactivate) a watch
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const watch = await prisma.competitorWatch.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!watch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.competitorWatch.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}

// PATCH /api/watches/[id]/alerts — mark alerts as read
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const watch = await prisma.competitorWatch.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!watch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.competitorAlert.updateMany({
    where: { watchId: id, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}

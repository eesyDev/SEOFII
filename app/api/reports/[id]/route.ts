import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  const report = await prisma.report.findUnique({
    where: { id, userId: session.user.id },
    select: { status: true, errorMessage: true },
  });

  if (!report) {
    return NextResponse.json({ error: "Не найден" }, { status: 404 });
  }

  return NextResponse.json(report);
}

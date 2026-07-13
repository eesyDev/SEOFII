// Публичная ссылка на отчёт: POST создаёт/возвращает токен, DELETE отзывает
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await prisma.report.findFirst({ where: { id, userId: session.user.id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = report.shareToken ?? randomBytes(16).toString("hex");
  if (!report.shareToken) {
    await prisma.report.update({ where: { id }, data: { shareToken: token } });
  }
  return NextResponse.json({ token });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await prisma.report.findFirst({ where: { id, userId: session.user.id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.report.update({ where: { id }, data: { shareToken: null } });
  return NextResponse.json({ ok: true });
}

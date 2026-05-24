import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

  if (user.reportsUsed >= user.reportsLimit) {
    return NextResponse.json(
      { error: "Лимит отчётов исчерпан. Перейди на платный план.", code: "LIMIT_REACHED" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const url: string = body?.url;
  const projectId: string | undefined = body?.projectId;
  const gscData = body?.gscData ?? null;
  const locationCode: number = body?.locationCode ?? 2840;

  if (!url) return NextResponse.json({ error: "URL обязателен" }, { status: 400 });

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Невалидный URL" }, { status: 400 });
  }

  const report = await prisma.report.create({
    data: {
      userId: session.user.id,
      url,
      projectId: projectId || null,
      status: "PENDING",
      gscData,
      locationCode,
    },
  });

  if (process.env.TRIGGER_SECRET_KEY) {
    // Async via Trigger.dev — отвечаем сразу, задача идёт в фоне
    const { tasks } = await import("@trigger.dev/sdk/v3");
    await tasks.trigger("generate-report", { reportId: report.id });
  } else {
    // Fallback: синхронно (dev без Trigger.dev, мок-режим)
    const { processReport } = await import("@/lib/processReport");
    await processReport(report.id);
  }

  return NextResponse.json({ reportId: report.id });
}

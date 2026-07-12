import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Генерация отчёта занимает ~3–4 минуты — функция должна жить после ответа
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

  if (user.reportsLimit !== null && user.reportsUsed >= user.reportsLimit) {
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
  const language: string = body?.language === "en" ? "en" : "ru";

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
      language,
    },
  });

  if (process.env.TRIGGER_SECRET_KEY) {
    const { tasks } = await import("@trigger.dev/sdk/v3");
    await tasks.trigger("generate-report", { reportId: report.id });
  } else {
    // Отвечаем сразу, генерацию продолжаем в фоне.
    // waitUntil — обязательно для Vercel: без него serverless-функция
    // завершается вместе с ответом и отчёт навсегда виснет в PENDING.
    // Локально ведёт себя как обычный фоновый promise.
    const { processReport } = await import("@/lib/processReport");
    waitUntil(
      processReport(report.id).catch((err) => {
        console.error(`[processReport] failed for ${report.id}:`, err);
      })
    );
  }

  return NextResponse.json({ reportId: report.id });
}

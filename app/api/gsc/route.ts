import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revokeGscConnection, type GscProperty } from "@/lib/gscApi";

// Статус подключения Search Console
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const conn = await prisma.gscConnection.findUnique({
    where: { userId: session.user.id },
    select: { googleEmail: true, properties: true, createdAt: true },
  });

  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  const properties = (conn.properties as unknown as GscProperty[] | null) ?? [];
  return NextResponse.json({
    connected: true,
    email: conn.googleEmail,
    properties: properties.map((p) => p.siteUrl),
    connectedAt: conn.createdAt,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  await revokeGscConnection(session.user.id);
  return NextResponse.json({ ok: true });
}

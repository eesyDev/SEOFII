import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWPConnection } from "@/lib/wordpress";

// GET /api/sites — list connected sites
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sites = await prisma.siteConnection.findMany({
    where: { userId: session.user.id, isActive: true },
    include: {
      pages: { take: 5, orderBy: { updatedAt: "desc" } },
      config: true,
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { changes: { orderBy: { createdAt: "desc" }, take: 20 } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ sites });
}

// POST /api/sites — connect a new site
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { url, type, username, appPassword, projectId } = body;

  if (!url || !type || !username || !appPassword) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate WordPress connection
  if (type === "WORDPRESS") {
    const check = await checkWPConnection(url, { username, appPassword });
    if (!check.ok) {
      return NextResponse.json({ error: `WordPress connection failed: ${check.error}` }, { status: 400 });
    }
  }

  // Create site + config
  const site = await prisma.siteConnection.create({
    data: {
      userId: session.user.id,
      projectId: projectId || null,
      type,
      url,
      credentials: { username, appPassword },
      config: {
        create: {
          autoApproveMeta: false,
          autoApproveSchema: false,
          autoApproveFaq: false,
          autoApproveContent: false,
          maxChangesPerWeek: 10,
          isEnabled: true,
        },
      },
    },
    include: {
      pages: { take: 5, orderBy: { updatedAt: "desc" } },
      config: true,
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { changes: { orderBy: { createdAt: "desc" }, take: 20 } },
      },
    },
  });

  return NextResponse.json({ site }, { status: 201 });
}

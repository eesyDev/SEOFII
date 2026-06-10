import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AutopilotClient from "@/components/autopilot/AutopilotClient";

function serializeSite(site: any) {
  return {
    ...site,
    createdAt: site.createdAt?.toISOString?.() || site.createdAt,
    updatedAt: site.updatedAt?.toISOString?.() || site.updatedAt,
    lastSyncAt: site.lastSyncAt?.toISOString?.() || site.lastSyncAt,
    pages: site.pages?.map((p: any) => ({
      ...p,
      createdAt: p.createdAt?.toISOString?.() || p.createdAt,
      updatedAt: p.updatedAt?.toISOString?.() || p.updatedAt,
      modifiedAt: p.modifiedAt?.toISOString?.() || p.modifiedAt,
    })),
    jobs: site.jobs?.map((j: any) => ({
      ...j,
      createdAt: j.createdAt?.toISOString?.() || j.createdAt,
      updatedAt: j.updatedAt?.toISOString?.() || j.updatedAt,
      changes: j.changes?.map((c: any) => ({
        ...c,
        createdAt: c.createdAt?.toISOString?.() || c.createdAt,
        appliedAt: c.appliedAt?.toISOString?.() || c.appliedAt,
        rolledBackAt: c.rolledBackAt?.toISOString?.() || c.rolledBackAt,
      })),
    })),
  };
}

export default async function AutopilotPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const rawSites = await prisma.siteConnection.findMany({
    where: { userId: session.user.id, isActive: true },
    include: {
      pages: { take: 5, orderBy: { updatedAt: "desc" } },
      config: true,
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          changes: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const sites = rawSites.map(serializeSite);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">SEO Autopilot</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your site. AI analyzes, suggests changes, and applies them — with your approval.
        </p>
      </div>

      <AutopilotClient initialSites={sites} />
    </div>
  );
}

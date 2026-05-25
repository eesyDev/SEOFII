import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { FolderOpen } from "lucide-react";
import NewProjectDialog from "@/components/dashboard/NewProjectDialog";
import ProjectCard from "@/components/dashboard/ProjectCard";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("Projects");

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { reports: true } } },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{projects.length}</p>
        </div>
        <NewProjectDialog />
      </div>

      {projects.length === 0 ? (
        <div className="border rounded-xl flex flex-col items-center justify-center py-20 text-center bg-background">
          <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium mb-1">{t("emptyText")}</p>
          <div className="mt-4">
            <NewProjectDialog />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

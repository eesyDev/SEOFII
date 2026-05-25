import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, FileText, ExternalLink } from "lucide-react";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "В очереди", PROCESSING: "Обрабатывается", DONE: "Готов", FAILED: "Ошибка",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline", PROCESSING: "secondary", DONE: "default", FAILED: "destructive",
};

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id, userId: session.user.id },
    include: {
      reports: {
        orderBy: { createdAt: "desc" },
        select: { id: true, url: true, status: true, createdAt: true, costUsd: true },
      },
    },
  });

  if (!project) notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/projects"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.domain}</p>
        </div>
        <Button asChild>
          <Link href={`/reports/new?projectId=${project.id}`}>
            <Plus className="h-4 w-4 mr-2" />
            Новый отчёт
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Отчёты <span className="text-muted-foreground font-normal ml-1">({project.reports.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {project.reports.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center gap-3">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Нет отчётов в этом проекте</p>
              <Button size="sm" asChild>
                <Link href={`/reports/new?projectId=${project.id}`}>Создать первый</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {project.reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{report.url}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(report.createdAt).toLocaleDateString("ru-RU")}
                      {report.costUsd && ` · $${Number(report.costUsd).toFixed(4)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <Badge variant={STATUS_VARIANT[report.status]}>
                      {STATUS_LABEL[report.status]}
                    </Badge>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

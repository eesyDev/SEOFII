import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, FolderOpen, TrendingUp, Plus } from "lucide-react";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "В очереди",
  PROCESSING: "Обрабатывается",
  DONE: "Готов",
  FAILED: "Ошибка",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "secondary",
  PROCESSING: "secondary",
  DONE: "default",
  FAILED: "destructive",
} as const;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, recentReports, projectsCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, reportsUsed: true, reportsLimit: true },
    }),
    prisma.report.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, url: true, status: true, createdAt: true,
        project: { select: { name: true } },
      },
    }),
    prisma.project.count({ where: { userId: session.user.id } }),
  ]);

  const usedPercent = user && user.reportsLimit > 0
    ? Math.round((user.reportsUsed / user.reportsLimit) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Дашборд</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Добро пожаловать, {session.user.name ?? session.user.email}
          </p>
        </div>
        <Button asChild>
          <Link href="/reports/new">
            <Plus className="h-4 w-4 mr-2" />
            Новый отчёт
          </Link>
        </Button>
      </div>

      {/* Статистика */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Отчётов использовано
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user?.reportsUsed ?? 0}
              <span className="text-muted-foreground text-base font-normal">
                {" "}/ {user?.reportsLimit === -1 ? "∞" : user?.reportsLimit ?? 3}
              </span>
            </div>
            {user && user.reportsLimit > 0 && (
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(usedPercent, 100)}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Проектов
            </CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <Link href="/projects" className="hover:underline">Управлять →</Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Тариф
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {user?.plan?.toLowerCase() ?? "free"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <Link href="/billing" className="hover:underline text-primary">
                Улучшить план →
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Последние отчёты */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Последние отчёты</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/reports">Все отчёты</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Ещё нет отчётов</p>
              <Button size="sm" className="mt-3" asChild>
                <Link href="/reports/new">Создать первый отчёт</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentReports.map((report) => (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{report.url}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.project?.name && `${report.project.name} · `}
                      {new Date(report.createdAt).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <Badge variant={STATUS_COLORS[report.status] as any} className="ml-3 shrink-0 text-xs">
                    {STATUS_LABELS[report.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

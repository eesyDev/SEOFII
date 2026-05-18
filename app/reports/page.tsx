import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileText, Plus, ExternalLink } from "lucide-react";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "В очереди",
  PROCESSING: "Обрабатывается",
  DONE: "Готов",
  FAILED: "Ошибка",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  PROCESSING: "secondary",
  DONE: "default",
  FAILED: "destructive",
};

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const reports = await prisma.report.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      status: true,
      costUsd: true,
      createdAt: true,
      project: { select: { name: true } },
    },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Отчёты</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {reports.length} {reports.length === 1 ? "отчёт" : "отчётов"}
          </p>
        </div>
        <Button asChild>
          <Link href="/reports/new">
            <Plus className="h-4 w-4 mr-2" />
            Новый отчёт
          </Link>
        </Button>
      </div>

      {reports.length === 0 ? (
        <div className="border rounded-xl flex flex-col items-center justify-center py-20 text-center bg-background">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium mb-1">Ещё нет отчётов</p>
          <p className="text-sm text-muted-foreground mb-4">
            Введи URL страницы — и мы сгенерируем ТЗ за минуту
          </p>
          <Button asChild>
            <Link href="/reports/new">Создать первый отчёт</Link>
          </Button>
        </div>
      ) : (
        <div className="border rounded-xl bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>URL</TableHead>
                <TableHead>Проект</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Стоимость</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="max-w-xs">
                    <Link
                      href={`/reports/${report.id}`}
                      className="font-medium hover:underline truncate block"
                    >
                      {report.url}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {report.project?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[report.status]}>
                      {STATUS_LABEL[report.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {report.costUsd ? `$${Number(report.costUsd).toFixed(4)}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {new Date(report.createdAt).toLocaleDateString("ru-RU")}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/reports/${report.id}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileText, Plus, ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  PROCESSING: "secondary",
  DONE: "default",
  FAILED: "destructive",
};

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("Reports");
  const locale = await getLocale();

  const reports = await prisma.report.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, url: true, status: true, costUsd: true, createdAt: true,
      project: { select: { name: true } },
    },
  });

  const STATUS_LABEL: Record<string, string> = {
    PENDING: t("statusPending"),
    PROCESSING: t("statusProcessing"),
    DONE: t("statusDone"),
    FAILED: t("statusFailed"),
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{reports.length}</p>
        </div>
        <Button asChild>
          <Link href="/reports/new">
            <Plus className="h-4 w-4 mr-2" />
            {t("newReport")}
          </Link>
        </Button>
      </div>

      {reports.length === 0 ? (
        <div className="border rounded-xl flex flex-col items-center justify-center py-20 text-center bg-background">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium mb-1">{t("emptyText")}</p>
          <Button asChild className="mt-4">
            <Link href="/reports/new">{t("emptyButton")}</Link>
          </Button>
        </div>
      ) : (
        <div className="border rounded-xl bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>URL</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="max-w-xs">
                    <Link href={`/reports/${report.id}`} className="font-medium hover:underline truncate block">
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
                    {new Date(report.createdAt).toLocaleDateString(locale)}
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

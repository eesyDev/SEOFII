"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, FileText, Trash2, ExternalLink } from "lucide-react";

interface Project {
  id: string;
  name: string;
  domain: string;
  createdAt: Date;
  _count: { reports: number };
}

export default function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Удалить проект «${project.name}»? Отчёты останутся.`)) return;
    setDeleting(true);
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Card className={deleting ? "opacity-50 pointer-events-none" : ""}>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="min-w-0">
          <CardTitle className="text-base truncate">{project.name}</CardTitle>
          <p className="text-sm text-muted-foreground truncate mt-0.5">{project.domain}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-2 -mt-1 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/projects/${project.id}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Открыть
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            {project._count.reports} отчётов
          </span>
          <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
            <Link href={`/reports/new?projectId=${project.id}`}>+ Отчёт</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

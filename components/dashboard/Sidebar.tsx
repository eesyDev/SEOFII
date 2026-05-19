"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FolderOpen, FileText, Settings, Zap, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Дашборд" },
  { href: "/projects", icon: FolderOpen, label: "Проекты" },
  { href: "/reports", icon: FileText, label: "Отчёты" },
  { href: "/billing", icon: CreditCard, label: "Биллинг" },
  { href: "/settings", icon: Settings, label: "Настройки" },
];

interface SidebarProps {
  reportsUsed: number;
  reportsLimit: number;
  plan: string;
}

export default function Sidebar({ reportsUsed, reportsLimit, plan }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 border-r bg-background min-h-screen">
      {/* Лого */}
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <Zap className="h-5 w-5 text-primary" />
        <span className="font-bold text-lg">SEOBrief</span>
        <Badge variant="secondary" className="text-xs ml-auto">Beta</Badge>
      </div>

      {/* Навигация */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Использование / апгрейд */}
      <div className="px-3 py-4 border-t">
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between mb-1">
            <p className="font-medium text-foreground capitalize">{plan.toLowerCase()} план</p>
            <span className="tabular-nums">{reportsUsed} / {reportsLimit}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-background overflow-hidden mb-2">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                reportsUsed >= reportsLimit ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${Math.min((reportsUsed / reportsLimit) * 100, 100)}%` }}
            />
          </div>
          <p className="mb-2">отчётов использовано</p>
          {plan === "FREE" && (
            <Link href="/billing" className="block text-primary font-medium hover:underline">
              Перейти на Pro →
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}

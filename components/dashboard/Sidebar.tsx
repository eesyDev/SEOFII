"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FolderOpen, FileText, Settings, Zap, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  reportsUsed: number;
  reportsLimit: number;
  plan: string;
}

export default function Sidebar({ reportsUsed, reportsLimit, plan }: SidebarProps) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard" as const, icon: LayoutDashboard, label: t("dashboard") },
    { href: "/projects"  as const, icon: FolderOpen,      label: t("projects") },
    { href: "/reports"   as const, icon: FileText,         label: t("reports") },
    { href: "/billing"   as const, icon: CreditCard,       label: t("billing") },
    { href: "/settings"  as const, icon: Settings,         label: t("settings") },
  ];

  // Strip locale prefix for active check
  const pathNoLocale = pathname.replace(/^\/(ru|en)/, "") || "/";

  return (
    <aside className="hidden md:flex flex-col w-60 border-r bg-background min-h-screen">
      <Link href="/" className="flex items-center gap-2 px-6 py-5 border-b hover:opacity-80 transition-opacity">
        <Zap className="h-5 w-5 text-primary" />
        <span className="font-bold text-lg">SEOBrief</span>
        <Badge variant="secondary" className="text-xs ml-auto">Beta</Badge>
      </Link>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathNoLocale === href || (href !== "/dashboard" && pathNoLocale.startsWith(href));
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

      <div className="px-3 py-4 border-t">
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between mb-1">
            <p className="font-medium text-foreground capitalize">{plan.toLowerCase()} {t("plan")}</p>
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
          <p className="mb-2">{t("reportsUsed")}</p>
          {plan === "FREE" && (
            <Link href="/billing" className="block text-primary font-medium hover:underline">
              {t("upgradePro")}
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}

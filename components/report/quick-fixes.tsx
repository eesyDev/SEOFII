import { useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";
import type { QuickFix } from "@/lib/claude";

const EFFORT_CONFIG = {
  "5min":    { label: "5 минут",  labelEn: "5 min", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  "30min":   { label: "30 минут", labelEn: "30 min", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  "2hours":  { label: "2 часа",   labelEn: "2 hours", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
} as const;

const CATEGORY_LABEL: Record<QuickFix["category"], string> = {
  meta:      "Мета-теги",
  content:   "Контент",
  links:     "Ссылки",
  technical: "Техника",
};
const CATEGORY_EN: Record<string, string> = {
  meta: "Meta tags", content: "Content", links: "Links", technical: "Technical",
};

function FixCard({ fix, index, en }: { fix: QuickFix; index: number; en: boolean }) {
  const effort = EFFORT_CONFIG[fix.effort] ?? EFFORT_CONFIG["30min"];

  return (
    <div className="flex gap-3 rounded-lg border bg-card p-4">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5">
            {en ? CATEGORY_EN[fix.category] ?? fix.category : CATEGORY_LABEL[fix.category]}
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${effort.className}`}>
            {en ? (effort as any).labelEn ?? effort.label : effort.label}
          </span>
        </div>
        <p className="text-sm font-medium leading-snug">{fix.action}</p>
        <p className="text-xs text-muted-foreground leading-snug">{fix.why}</p>
        {fix.where && (
          <p className="text-xs text-muted-foreground truncate">
            {en ? "Where:" : "Где:"}{" "}
            {fix.where.startsWith("http") ? (
              <a
                href={fix.where}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                {fix.where}
              </a>
            ) : (
              <span className="italic">{fix.where}</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

interface Props {
  quickFixes: QuickFix[];
}

export function QuickFixesSection({ quickFixes }: Props) {
  const en = useLocale() === "en";
  if (quickFixes.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4" /> {en ? "Fix this weekend" : "Что починить за выходные"}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          {en ? "Concrete tasks, no SEO jargon — doable without a specialist" : "Конкретные задачи без SEO-терминов — можно делать без специалиста"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {quickFixes.map((fix, i) => (
          <FixCard key={i} fix={fix} index={i} en={en} />
        ))}
      </CardContent>
    </Card>
  );
}

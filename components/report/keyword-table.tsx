"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown, Table2 } from "lucide-react";
import type { EnrichedKeyword } from "@/lib/analytics";

type SortKey = "keyword" | "volume" | "cpc" | "competition" | "gscPosition" | "occurrences";
type SortDir = "asc" | "desc";

const TAG_CONFIG = {
  "top3":      { label: "Топ-3",      className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  "quick-win": { label: "Quick win",  className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  "gap":       { label: "Gap",        className: "bg-blue-100  text-blue-800  dark:bg-blue-900/30  dark:text-blue-400"  },
  "owned":     { label: "Owned",      className: "bg-slate-100 text-slate-600 dark:bg-slate-800    dark:text-slate-400" },
} as const;

const TAGS = ["all", "gap", "quick-win", "top3", "owned"] as const;
type TagFilter = (typeof TAGS)[number];

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3" />
    : <ArrowDown className="h-3 w-3" />;
}

function Th({
  label, col, sortKey, dir, onClick,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th
      className="text-left text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap px-3 py-2 hover:text-foreground transition-colors"
      onClick={onClick}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon col={col} sortKey={sortKey} dir={dir} />
      </span>
    </th>
  );
}

export function KeywordTable({ keywords }: { keywords: EnrichedKeyword[] }) {
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = keywords
    .filter((k) => tagFilter === "all" || k.tag === tagFilter)
    .sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });

  const hasGsc = keywords.some((k) => k.gscPosition !== undefined);

  const counts = {
    all: keywords.length,
    gap: keywords.filter((k) => k.tag === "gap").length,
    "quick-win": keywords.filter((k) => k.tag === "quick-win").length,
    top3: keywords.filter((k) => k.tag === "top3").length,
    owned: keywords.filter((k) => k.tag === "owned").length,
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Table2 className="h-4 w-4" /> Все ключевые слова
          </CardTitle>
          {/* Фильтры по тегу */}
          <div className="flex gap-1 flex-wrap">
            {TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setTagFilter(t)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  tagFilter === t
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "all" ? "Все" : TAG_CONFIG[t]?.label ?? t}
                <span className="ml-1 opacity-60">{counts[t]}</span>
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y bg-muted/30">
              <tr>
                <Th label="Ключевое слово" col="keyword"     sortKey={sortKey} dir={sortDir} onClick={() => toggleSort("keyword")} />
                <Th label="Volume"         col="volume"      sortKey={sortKey} dir={sortDir} onClick={() => toggleSort("volume")} />
                <Th label="CPC"            col="cpc"         sortKey={sortKey} dir={sortDir} onClick={() => toggleSort("cpc")} />
                <Th label="Конк."          col="competition" sortKey={sortKey} dir={sortDir} onClick={() => toggleSort("competition")} />
                <Th label="У конкурентов" col="occurrences" sortKey={sortKey} dir={sortDir} onClick={() => toggleSort("occurrences")} />
                {hasGsc && <Th label="GSC поз." col="gscPosition" sortKey={sortKey} dir={sortDir} onClick={() => toggleSort("gscPosition")} />}
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Тег</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={hasGsc ? 7 : 6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Нет ключей по выбранному фильтру
                  </td>
                </tr>
              ) : (
                filtered.map((k, i) => {
                  const tag = TAG_CONFIG[k.tag];
                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 font-medium max-w-[200px] truncate">{k.keyword}</td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{k.volume.toLocaleString()}</td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">${Number(k.cpc).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <CompBar value={Number(k.competition)} />
                      </td>
                      <td className="px-3 py-2 tabular-nums text-center text-muted-foreground">
                        {k.occurrences > 0 ? (
                          <span className="font-medium text-foreground">{k.occurrences}</span>
                        ) : (
                          <span className="opacity-40">—</span>
                        )}
                      </td>
                      {hasGsc && (
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                          {k.gscPosition !== undefined ? (
                            <span className={k.gscPosition <= 3 ? "text-green-600 font-medium" : k.gscPosition <= 10 ? "text-blue-600" : "text-amber-600"}>
                              {k.gscPosition.toFixed(1)}
                            </span>
                          ) : (
                            <span className="opacity-40">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tag.className}`}>
                          {tag.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CompBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct > 66 ? "bg-red-500" : pct > 33 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  );
}

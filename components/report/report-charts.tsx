"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, Zap } from "lucide-react";
import type { EnrichedKeyword } from "@/lib/analytics";
import type { GscRow } from "@/lib/gsc";

// ─────────────────────────────────────────
// Горизонтальный bar chart: топ ключей по volume
// ─────────────────────────────────────────

const TAG_COLOR: Record<string, string> = {
  "top3":       "#22c55e",
  "quick-win":  "#f59e0b",
  "gap":        "#3b82f6",
  "owned":      "#94a3b8",
};

export function VolumeChart({ keywords }: { keywords: EnrichedKeyword[] }) {
  const data = keywords
    .slice(0, 15)
    .map((k) => ({
      name: k.keyword.length > 22 ? k.keyword.slice(0, 20) + "…" : k.keyword,
      fullName: k.keyword,
      volume: k.volume,
      tag: k.tag,
    }))
    .reverse(); // recharts рисует снизу вверх

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart2 className="h-4 w-4" /> Объём поиска — топ ключей
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={data.length * 28 + 20}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, _, entry) => [
                Number(value).toLocaleString() + " / мес",
                (entry as any)?.payload?.fullName ?? "",
              ]}
              labelFormatter={() => ""}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="volume" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={TAG_COLOR[entry.tag] ?? "#94a3b8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Легенда */}
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
          {[
            { tag: "top3",      label: "Топ-3" },
            { tag: "quick-win", label: "Quick win" },
            { tag: "gap",       label: "Gap" },
            { tag: "owned",     label: "Owned" },
          ].map(({ tag, label }) => (
            <span key={tag} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: TAG_COLOR[tag] }} />
              {label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// Bar chart: распределение позиций GSC
// ─────────────────────────────────────────

const BUCKET_LABELS = ["1–3", "4–10", "11–20", "21+"];
const BUCKET_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#94a3b8"];

function bucketRows(rows: GscRow[]) {
  const buckets = [0, 0, 0, 0];
  for (const r of rows) {
    if (r.position <= 3) buckets[0]++;
    else if (r.position <= 10) buckets[1]++;
    else if (r.position <= 20) buckets[2]++;
    else buckets[3]++;
  }
  return BUCKET_LABELS.map((name, i) => ({ name, count: buckets[i], color: BUCKET_COLORS[i] }));
}

export function GscPositionsChart({ gscRows }: { gscRows: GscRow[] }) {
  if (gscRows.length === 0) return null;

  const data = bucketRows(gscRows);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4" /> Распределение позиций GSC
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              formatter={(v) => [Number(v), "запросов"]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Позиция в поиске (средняя за период)
        </p>
      </CardContent>
    </Card>
  );
}

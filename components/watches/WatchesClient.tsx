"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Bell, BellOff, ExternalLink, Eye } from "lucide-react";

interface Alert {
  id: string;
  changeType: string;
  summary: string;
  detectedAt: string;
  isRead: boolean;
  diff?: Record<string, { before: string | number; after: string | number }>;
}

interface Snapshot {
  id: string;
  takenAt: string;
  wordCount: number;
  title: string;
}

interface Watch {
  id: string;
  label: string;
  url: string;
  createdAt: string;
  snapshots: Snapshot[];
  alerts: Alert[];
  _count: { alerts: number };
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  title_changed: "Title changed",
  content_updated: "Content updated",
  product_added: "Product added",
  price_changed: "Price changed",
};

export default function WatchesClient({ initialWatches }: { initialWatches: Watch[] }) {
  const [watches, setWatches] = useState<Watch[]>(initialWatches);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ url: "", label: "" });
  const [adding, setAdding] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [error, setError] = useState("");

  const unreadTotal = watches.reduce(
    (sum, w) => sum + w.alerts.filter((a) => !a.isRead).length,
    0
  );

  async function addWatch() {
    if (!form.url || !form.label) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setWatches((prev) => [data.watch, ...prev]);
      setForm({ url: "", label: "" });
      setShowAdd(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setAdding(false);
    }
  }

  async function deleteWatch(id: string) {
    await fetch(`/api/watches/${id}`, { method: "DELETE" });
    setWatches((prev) => prev.filter((w) => w.id !== id));
  }

  async function markRead(id: string) {
    await fetch(`/api/watches/${id}`, { method: "PATCH" });
    setWatches((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, alerts: w.alerts.map((a) => ({ ...a, isRead: true })) } : w
      )
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Competitor Watch</h1>
          <p className="text-sm text-muted-foreground mt-1">
            We check competitor pages weekly and alert you when something changes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadTotal > 0 && (
            <span className="text-xs bg-orange-500 text-white rounded-full px-2 py-0.5 font-medium">
              {unreadTotal} new
            </span>
          )}
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="size-4" />
            Add URL
          </Button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">Track a competitor page</p>
          <div className="space-y-2">
            <input
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              placeholder="Label — e.g. Werk-Brau hydraulic thumbs"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
            <input
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              placeholder="https://competitor.com/product-page"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={addWatch} disabled={adding}>
              {adding ? "Scraping initial snapshot…" : "Start watching"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {watches.length === 0 && !showAdd && (
        <div className="border border-dashed border-border rounded-xl p-10 text-center text-muted-foreground">
          <p className="text-sm">No watches yet.</p>
          <p className="text-sm mt-1">Add a competitor URL to start monitoring.</p>
        </div>
      )}

      {/* Watch list */}
      <div className="space-y-4">
        {watches.map((watch) => {
          const unread = watch.alerts.filter((a) => !a.isRead);
          const latest = watch.snapshots[0];
          return (
            <div
              key={watch.id}
              className="border border-border rounded-xl p-4 space-y-3"
            >
              {/* Watch header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{watch.label}</span>
                    {unread.length > 0 && (
                      <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 shrink-0">
                        {unread.length} new
                      </span>
                    )}
                  </div>
                  <a
                    href={watch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-0.5 truncate"
                  >
                    {watch.url}
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {unread.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Mark all as read"
                      onClick={() => markRead(watch.id)}
                    >
                      <Eye className="size-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Stop watching"
                    onClick={() => deleteWatch(watch.id)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {/* Latest snapshot stats */}
              {latest && (
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    Last checked:{" "}
                    {new Date(latest.takenAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span>{latest.wordCount.toLocaleString()} words</span>
                  {latest.title && (
                    <span className="truncate max-w-[200px]" title={latest.title}>
                      {latest.title}
                    </span>
                  )}
                </div>
              )}

              {/* Alerts */}
              {watch.alerts.length > 0 && (
                <div className="space-y-2">
                  {watch.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-lg border p-3 text-sm cursor-pointer transition-colors ${
                        alert.isRead
                          ? "border-border bg-muted/20 text-muted-foreground"
                          : "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30"
                      }`}
                      onClick={() =>
                        setExpandedAlert((prev) => (prev === alert.id ? null : alert.id))
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {alert.isRead ? (
                            <BellOff className="size-3.5 shrink-0" />
                          ) : (
                            <Bell className="size-3.5 shrink-0 text-orange-600" />
                          )}
                          <span className="font-medium">
                            {CHANGE_TYPE_LABELS[alert.changeType] || alert.changeType}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(alert.detectedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-sm leading-snug">{alert.summary}</p>

                      {/* Expanded diff */}
                      {expandedAlert === alert.id && alert.diff && (
                        <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
                          {Object.entries(alert.diff).map(([key, val]) => (
                            <div key={key} className="text-xs">
                              <span className="font-medium text-muted-foreground uppercase tracking-wide">
                                {key}
                              </span>
                              {val.before !== "" && (
                                <div className="mt-0.5 text-red-600 dark:text-red-400 line-through opacity-70">
                                  {String(val.before)}
                                </div>
                              )}
                              {val.after !== "" && (
                                <div className="mt-0.5 text-green-700 dark:text-green-400">
                                  {String(val.after)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {watch.alerts.length === 0 && latest && (
                <p className="text-xs text-muted-foreground">No changes detected yet.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Rocket,
  CheckCircle,
  XCircle,
  RotateCcw,
  ExternalLink,
  Loader2,
  Globe,
  Shield,
} from "lucide-react";

interface Change {
  id: string;
  pageUrl: string;
  field: string;
  oldValue: string | null;
  newValue: string;
  aiReasoning: string | null;
  status: string;
  appliedAt: string | null;
}

interface Job {
  id: string;
  status: string;
  pageCount: number;
  changeCount: number;
  createdAt: string;
  changes: Change[];
}

interface Site {
  id: string;
  url: string;
  type: string;
  lastSyncAt: string | null;
  pages: Array<{ id: string; url: string; title: string | null }>;
  config: {
    autoApproveMeta: boolean;
    isEnabled: boolean;
  } | null;
  jobs: Job[];
}

interface Props {
  initialSites: Site[];
}

export default function AutopilotClient({ initialSites }: Props) {
  const [sites, setSites] = useState<Site[]>(initialSites);
  const [connecting, setConnecting] = useState(false);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [processingChange, setProcessingChange] = useState<string | null>(null);

  // Connect form state
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);

    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.replace(/\/$/, ""),
          type: "WORDPRESS",
          username,
          appPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect");

      toast.success("Site connected!");
      setSites((prev) => [...prev, data.site]);
      setUrl("");
      setUsername("");
      setAppPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function runAutopilot(siteId: string) {
    setRunningJob(siteId);
    try {
      const res = await fetch(`/api/sites/${siteId}/autopilot`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Autopilot failed");

      toast.success(`Autopilot complete! ${data.job.changeCount} changes suggested.`);
      // Refresh sites
      const refreshRes = await fetch("/api/sites");
      const refreshData = await refreshRes.json();
      setSites(refreshData.sites);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Autopilot failed");
    } finally {
      setRunningJob(null);
    }
  }

  async function handleChangeAction(changeId: string, action: "approve" | "apply" | "reject" | "rollback") {
    setProcessingChange(changeId);
    try {
      const res = await fetch(`/api/autopilot/changes/${changeId}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      toast.success(
        action === "approve"
          ? "Change approved!"
          : action === "apply"
          ? "Change applied to your site!"
          : action === "reject"
          ? "Change rejected"
          : "Change rolled back"
      );

      // Refresh
      const refreshRes = await fetch("/api/sites");
      const refreshData = await refreshRes.json();
      setSites(refreshData.sites);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setProcessingChange(null);
    }
  }

  const pendingChanges = sites.flatMap((s) =>
    s.jobs.flatMap((j) => j.changes.filter((c) => c.status === "PENDING"))
  );

  return (
    <div className="space-y-8">
      {/* Connect Site Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            Connect Your Site
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sites.length === 0 ? (
            <form onSubmit={handleConnect} className="space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="url">Site URL</Label>
                <Input
                  id="url"
                  placeholder="https://your-site.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">WordPress Username</Label>
                  <Input
                    id="username"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    App Password{" "}
                    <span className="text-xs text-muted-foreground">(not your login password)</span>
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Go to WordPress → Users → Your Profile → Application Passwords → Add New.
              </p>
              <Button type="submit" disabled={connecting} className="gap-2">
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Connect WordPress Site
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              {sites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{site.url}</p>
                      <p className="text-xs text-muted-foreground">
                        {site.pages.length} pages · Last sync:{" "}
                        {site.lastSyncAt ? new Date(site.lastSyncAt).toLocaleDateString() : "Never"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {site.type}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => runAutopilot(site.id)}
                      disabled={runningJob === site.id}
                      className="gap-2"
                    >
                      {runningJob === site.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Rocket className="h-4 w-4" />
                      )}
                      Run Autopilot
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Changes Queue */}
      {pendingChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-amber-500" />
              Changes Pending Approval
              <Badge variant="secondary">{pendingChanges.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingChanges.map((change) => (
              <div
                key={change.id}
                className="p-4 rounded-lg border space-y-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {change.field.replace("_", " ")}
                    </Badge>
                    <a
                      href={change.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline"
                    >
                      {new URL(change.pageUrl).pathname}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => handleChangeAction(change.id, "approve")}
                      disabled={processingChange === change.id}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleChangeAction(change.id, "reject")}
                      disabled={processingChange === change.id}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {change.oldValue && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground shrink-0 w-10">Old:</span>
                      <span className="text-muted-foreground line-through">{change.oldValue}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-primary font-medium shrink-0 w-10">New:</span>
                    <span className="text-foreground font-medium">{change.newValue}</span>
                  </div>
                  {change.aiReasoning && (
                    <div className="flex gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <span className="shrink-0">🤖</span>
                      <span>{change.aiReasoning}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Approved / Applied Changes */}
      {sites.some((s) => s.jobs.some((j) => j.changes.some((c) => c.status === "APPROVED" || c.status === "APPLIED"))) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Applied & Approved Changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sites.flatMap((s) =>
              s.jobs.flatMap((j) =>
                j.changes
                  .filter((c) => c.status === "APPROVED" || c.status === "APPLIED" || c.status === "ROLLED_BACK")
                  .map((change) => (
                    <div
                      key={change.id}
                      className="flex items-center justify-between p-3 rounded-lg border text-sm"
                    >
                      <div className="flex items-center gap-3">
                        {change.status === "APPLIED" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : change.status === "ROLLED_BACK" ? (
                          <RotateCcw className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Shield className="h-4 w-4 text-blue-500" />
                        )}
                        <div>
                          <span className="font-medium">{change.field.replace("_", " ")}</span>
                          <span className="text-muted-foreground mx-2">→</span>
                          <span className="text-muted-foreground truncate max-w-xs inline-block align-bottom">
                            {change.newValue}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {change.status === "APPLIED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleChangeAction(change.id, "rollback")}
                            disabled={processingChange === change.id}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Rollback
                          </Button>
                        )}
                        {change.status === "APPROVED" && (
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleChangeAction(change.id, "apply")}
                            disabled={processingChange === change.id}
                          >
                            <Rocket className="h-3 w-3" />
                            Apply Now
                          </Button>
                        )}
                        <Badge
                          variant={
                            change.status === "APPLIED"
                              ? "default"
                              : change.status === "ROLLED_BACK"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {change.status.toLowerCase().replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  ))
              )
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

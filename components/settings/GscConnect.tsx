"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Search, Unplug } from "lucide-react";
import { toast } from "sonner";

interface GscStatus {
  connected: boolean;
  email?: string | null;
  properties?: string[];
}

export default function GscConnect() {
  const t = useTranslations("Settings");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GscStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/gsc")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));
  }, []);

  useEffect(() => {
    const gsc = searchParams.get("gsc");
    if (gsc === "connected") toast.success(t("gscToastConnected"));
    if (gsc === "error") toast.error(t("gscToastError"));
    if (gsc) router.replace("/settings", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/gsc", { method: "DELETE" }).catch(() => {});
    setStatus({ connected: false });
    setDisconnecting(false);
    toast.success(t("gscToastDisconnected"));
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("gscLoading")}
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("gscNotConnected")}</p>
        <Button asChild>
          <a href="/api/gsc/connect">
            <Search className="h-4 w-4 mr-2" />
            {t("gscConnect")}
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span>
          {t("gscConnectedAs")}{" "}
          <span className="font-medium">{status.email ?? "Google"}</span>
        </span>
      </div>

      {status.properties && status.properties.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <p className="mb-1">{t("gscProperties")}:</p>
          <ul className="space-y-0.5">
            {status.properties.slice(0, 8).map((p) => (
              <li key={p} className="font-mono text-xs">
                {p.replace("sc-domain:", "🌐 ")}
              </li>
            ))}
            {status.properties.length > 8 && (
              <li className="text-xs">+{status.properties.length - 8}</li>
            )}
          </ul>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={handleDisconnect}
        disabled={disconnecting}
      >
        {disconnecting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Unplug className="h-4 w-4 mr-2" />
        )}
        {t("gscDisconnect")}
      </Button>
    </div>
  );
}

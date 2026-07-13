"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";

export function ShareButton({ reportId }: { reportId: string }) {
  const locale = useLocale();
  const en = locale === "en";
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/share`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const url = `${window.location.origin}/${locale}/reports/${reportId}?share=${data.token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(en ? "Public link copied — anyone can view, no login" : "Публичная ссылка скопирована — откроется без логина");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error(en ? "Failed to create link" : "Не удалось создать ссылку");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" className="no-print gap-1.5" onClick={handleShare} disabled={loading}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? (en ? "Copied" : "Скопировано") : (en ? "Share" : "Поделиться")}
    </Button>
  );
}

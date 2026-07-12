"use client";

import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function PrintButton() {
  const en = useLocale() === "en";
  return (
    <Button
      variant="outline"
      size="sm"
      className="no-print gap-1.5"
      onClick={() => window.print()}
    >
      <Download className="h-3.5 w-3.5" />
      {en ? "Download PDF" : "Скачать PDF"}
    </Button>
  );
}

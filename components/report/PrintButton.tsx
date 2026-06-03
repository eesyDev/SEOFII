"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function PrintButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="no-print gap-1.5"
      onClick={() => window.print()}
    >
      <Download className="h-3.5 w-3.5" />
      Скачать PDF
    </Button>
  );
}

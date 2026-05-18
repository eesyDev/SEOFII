"use client";

import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

export default function SuccessBanner() {
  // Убираем ?success=1 из URL без перерендера
  useEffect(() => {
    const t = setTimeout(() => {
      window.history.replaceState({}, "", "/billing");
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800">
      <CheckCircle2 className="h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-medium">Оплата прошла успешно!</p>
        <p className="text-xs opacity-80">Твой тариф обновлён. Приятной работы 🎉</p>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  reportId: string;
  initialStatus: string;
}

export function ReportPoller({ reportId, initialStatus }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (initialStatus !== "PENDING" && initialStatus !== "PROCESSING") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status !== "PENDING" && data.status !== "PROCESSING") {
          clearInterval(interval);
          router.refresh();
        }
      } catch {
        // сеть упала — попробуем на следующей итерации
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [reportId, initialStatus, router]);

  return null;
}

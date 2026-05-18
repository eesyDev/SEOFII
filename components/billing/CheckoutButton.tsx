"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  planId: "STARTER" | "PRO";
  isCurrent: boolean;
  isHighlight: boolean;
}

export default function CheckoutButton({ planId, isCurrent, isHighlight }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);

    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      setLoading(false);
    }
  }

  if (isCurrent) {
    return (
      <Button variant="outline" className="w-full" disabled>
        Текущий план
      </Button>
    );
  }

  return (
    <Button
      className="w-full"
      variant={isHighlight ? "default" : "outline"}
      onClick={handleCheckout}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        "Выбрать план"
      )}
    </Button>
  );
}

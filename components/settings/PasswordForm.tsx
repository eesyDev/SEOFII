"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Ошибка смены пароля");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setCurrent("");
    setNext("");
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="current-pw">Текущий пароль</Label>
        <Input
          id="current-pw"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="••••••••"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-pw">Новый пароль</Label>
        <Input
          id="new-pw"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="Минимум 6 символов"
          minLength={6}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Изменить пароль"}
        </Button>
        {success && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Пароль изменён
          </span>
        )}
      </div>
    </form>
  );
}

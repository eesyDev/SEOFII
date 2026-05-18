"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  name: string;
  email: string;
  image: string | null;
}

export default function ProfileForm({ name, email, image }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : email[0].toUpperCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Ошибка сохранения");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    router.refresh();
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarImage src={image ?? undefined} />
          <AvatarFallback className="text-lg font-medium">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{email}</p>
          <p className="text-xs text-muted-foreground">Аватар синхронизируется с Google</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Имя</Label>
        <Input
          id="name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Иван Иванов"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={email} disabled className="opacity-60" />
        <p className="text-xs text-muted-foreground">Email изменить нельзя</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
        </Button>
        {success && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Сохранено
          </span>
        )}
      </div>
    </form>
  );
}

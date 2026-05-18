"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function DangerZone() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (confirm !== "удалить") return;
    setLoading(true);

    await fetch("/api/settings/account", { method: "DELETE" });
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-background p-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Удалить аккаунт</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Удалит все проекты, отчёты и данные. Необратимо.
        </p>
      </div>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); setConfirm(""); }}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm">Удалить аккаунт</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить аккаунт?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Все твои данные будут удалены навсегда. Это действие нельзя отменить.
          </p>
          <div className="space-y-1.5 mt-2">
            <Label htmlFor="confirm-delete">
              Напиши <span className="font-semibold text-foreground">удалить</span> для подтверждения
            </Label>
            <Input
              id="confirm-delete"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="удалить"
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button
              variant="destructive"
              disabled={confirm !== "удалить" || loading}
              onClick={handleDelete}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Удалить навсегда"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

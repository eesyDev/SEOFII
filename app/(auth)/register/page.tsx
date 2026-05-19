"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Zap, Globe, AlertCircle, Check, X } from "lucide-react";

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${met ? "text-green-600" : "text-muted-foreground"}`}>
      {met ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
      {label}
    </li>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordChecks = {
    length: password.length >= 8,
    letter: /[a-zA-Zа-яА-ЯёЁ]/.test(password),
    digit: /\d/.test(password),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordValid) return;
    setLoading(true);
    setError("");

    // Шаг 1: регистрация
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Ошибка регистрации");
      setLoading(false);
      return;
    }

    // Шаг 2: логин сразу после регистрации
    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setError("Аккаунт создан, но не удалось войти. Попробуй войти вручную.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh(); // обновляем Server Components с новой сессией
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Zap className="h-6 w-6" />
          <span className="text-2xl font-bold">SEOBrief</span>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Создать аккаунт</CardTitle>
            <CardDescription>3 отчёта бесплатно — без карты</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              <Globe className="h-4 w-4 mr-2" />
              Зарегистрироваться через Google
            </Button>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">или</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Имя</Label>
                <Input
                  id="name"
                  placeholder="Иван Иванов"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  className={error ? "border-destructive focus-visible:ring-destructive" : ""}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  className={error ? "border-destructive focus-visible:ring-destructive" : ""}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Минимум 8 символов"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className={
                    password.length > 0 && !passwordValid
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                  required
                />
                {password.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    <PasswordRule met={passwordChecks.length}  label="Минимум 8 символов" />
                    <PasswordRule met={passwordChecks.letter}  label="Хотя бы одна буква" />
                    <PasswordRule met={passwordChecks.digit}   label="Хотя бы одна цифра" />
                  </ul>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || !passwordValid}>
                {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Уже есть аккаунт?{" "}
              <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
                Войти
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

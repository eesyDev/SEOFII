"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Auth.register");
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

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : t("errorGeneric"));
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setError(t("errorLoginAfterRegister"));
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
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
            <CardTitle className="text-xl">{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
              <Globe className="h-4 w-4 mr-2" />
              {t("googleButton")}
            </Button>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">{t("or")}</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("nameLabel")}</Label>
                <Input
                  id="name" placeholder={t("namePlaceholder")}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("emailLabel")}</Label>
                <Input
                  id="email" type="email" placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("passwordLabel")}</Label>
                <Input
                  id="password" type="password" placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className={password.length > 0 && !passwordValid ? "border-destructive focus-visible:ring-destructive" : ""}
                  required
                />
                {password.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    <PasswordRule met={passwordChecks.length} label={t("ruleLength")} />
                    <PasswordRule met={passwordChecks.letter} label={t("ruleLetter")} />
                    <PasswordRule met={passwordChecks.digit}  label={t("ruleDigit")} />
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
                {loading ? t("submitting") : t("submit")}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              {t("hasAccount")}{" "}
              <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
                {t("loginLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

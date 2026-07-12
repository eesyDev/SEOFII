"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(() => {
      router.replace(pathname, { locale: locale === "ru" ? "en" : "ru" });
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      aria-busy={isPending}
      className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:border-white/20 hover:text-white disabled:cursor-wait disabled:opacity-60"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <>
          <span className={locale === "ru" ? "text-white" : "text-zinc-500"}>RU</span>
          <span className="text-zinc-600">/</span>
          <span className={locale === "en" ? "text-white" : "text-zinc-500"}>EN</span>
        </>
      )}
    </button>
  );
}

"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function toggle() {
    router.replace(pathname, { locale: locale === "ru" ? "en" : "ru" });
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
    >
      <span className={locale === "ru" ? "text-white" : "text-zinc-500"}>RU</span>
      <span className="text-zinc-600">/</span>
      <span className={locale === "en" ? "text-white" : "text-zinc-500"}>EN</span>
    </button>
  );
}

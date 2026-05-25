import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Search, BarChart2, FileText, Check, Zap, ArrowRight, Sparkles, TrendingUp, Clock } from "lucide-react";
import HeroVisual from "@/components/landing/HeroVisual";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return locale === "ru"
    ? {
        title: "SEOBrief — SEO-анализ и готовый контент за минуту",
        description:
          "Вставь URL — получи разбор конкурентов, gap-анализ и готовые тексты (title, H1, meta, FAQ) которые можно сразу скопировать на сайт. Первый отчёт бесплатно.",
      }
    : {
        title: "SEOBrief — SEO analysis and ready content in minutes",
        description:
          "Enter a URL — get a competitor breakdown, gap analysis, and ready-to-paste texts (title, H1, meta, FAQ) for your site. First report free.",
      };
}

const FEATURE_ICONS = [Search, BarChart2, FileText];
const STAT_ICONS = [TrendingUp, Sparkles, Clock];
const PLAN_NAMES = ["Free", "Starter", "Pro", "Agency"] as const;
const PLAN_PRICES = ["0", "25", "50", "120"];

export default async function HomePage() {
  const t = await getTranslations("Landing");

  const features = FEATURE_ICONS.map((icon, i) => ({
    icon,
    step: String(i + 1).padStart(2, "0"),
    title: t(`howItWorks.features.${i}.title`),
    description: t(`howItWorks.features.${i}.description`),
  }));

  const stats = [
    { icon: STAT_ICONS[0], value: t("stats.timeValue"),  label: t("stats.timeLabel") },
    { icon: STAT_ICONS[1], value: t("stats.aiValue"),    label: t("stats.aiLabel") },
    { icon: STAT_ICONS[2], value: t("stats.tasksValue"), label: t("stats.tasksLabel") },
  ];

  const plans = PLAN_NAMES.map((name, i) => {
    const key = name.toLowerCase() as "free" | "starter" | "pro" | "agency";
    return {
      name,
      price: PLAN_PRICES[i],
      description: t(`pricing.plans.${key}.description`),
      perks: t.raw(`pricing.plans.${key}.perks`) as string[],
      cta: t(`pricing.plans.${key}.cta`),
      highlight: name === "Pro",
      agency: name === "Agency",
    };
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "SEOBrief",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "url": "https://seobrief.ru",
        "description": t("hero.subtitle"),
        "offers": PLAN_NAMES.slice(0, 3).map((name, i) => ({
          "@type": "Offer",
          "name": name,
          "price": PLAN_PRICES[i],
          "priceCurrency": "USD",
          "description": t(`pricing.plans.${name.toLowerCase() as "free" | "starter" | "pro"}.description`),
        })),
      },
      {
        "@type": "Organization",
        "name": "SEOBrief",
        "url": "https://seobrief.ru",
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#060a0f] text-white overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── NAV ── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[#060a0f]/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fd356e]/20">
              <Zap className="h-4 w-4 text-[#fd356e]" />
            </div>
            <span className="text-lg font-semibold tracking-tight">SEOBrief</span>
            <span className="ml-1 rounded-full border border-[#fd356e]/30 bg-[#fd356e]/10 px-2 py-0.5 text-[10px] font-medium text-[#fd356e]">
              Beta
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5">
              {t("nav.login")}
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-1.5 rounded-lg bg-[#fd356e] px-4 py-2 text-sm font-medium text-white hover:bg-[#ff5a84] transition-colors"
            >
              {t("nav.register")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative flex min-h-screen items-center px-5 pt-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-blob absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full bg-[#fd356e]/15 blur-[120px]" />
          <div className="animate-blob-delay absolute -right-40 top-1/3 h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-[120px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[300px] w-[600px] rounded-full bg-[#fd356e]/8 blur-[100px]" />
        </div>

        <div className="container mx-auto max-w-6xl w-full py-20">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div className="animate-fade-up">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#fd356e]/20 bg-[#fd356e]/5 px-4 py-1.5 text-sm text-[#fd356e]/80">
                <Sparkles className="h-3.5 w-3.5 text-[#fd356e]" />
                {t("hero.badge")}
              </div>

              <h1 className="mb-6 text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
                {t("hero.h1")}
                <br />
                <span className="animate-gradient-text bg-gradient-to-r from-[#fd356e] via-[#ff8fab] to-[#fd356e] bg-clip-text text-transparent">
                  {t("hero.h1Accent")}
                </span>
              </h1>

              <p className="mb-10 max-w-xl text-lg leading-relaxed text-zinc-400 font-light">
                {t("hero.subtitle")}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#fd356e] px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-[#fd356e]/25 hover:bg-[#ff5a84] transition-all"
                >
                  {t("hero.ctaPrimary")} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-base font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition-all"
                >
                  {t("hero.ctaSecondary")}
                </Link>
              </div>

              <div className="mt-12 flex flex-col gap-5 sm:flex-row sm:gap-10">
                {stats.map((s) => (
                  <div key={s.label} className="flex items-center gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fd356e]/10">
                      <s.icon className="h-4 w-4 text-[#fd356e]" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-white">{s.value}</p>
                      <p className="text-zinc-500">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:flex items-center justify-center">
              <HeroVisual />
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-zinc-600">
          <div className="h-6 w-[1px] bg-gradient-to-b from-transparent to-zinc-600" />
          <span className="text-[10px] tracking-widest uppercase">Scroll</span>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="relative py-28 px-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-[#fd356e]/5 blur-[100px]" />
        </div>
        <div className="container mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-sm font-medium text-[#fd356e] uppercase tracking-widest">
              {t("howItWorks.sectionLabel")}
            </p>
            <h2 className="text-4xl font-semibold">{t("howItWorks.title")}</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-[#fd356e]/30 hover:bg-white/[0.04] transition-all"
              >
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-[#fd356e]/5 to-transparent" />
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fd356e]/10">
                      <f.icon className="h-5 w-5 text-[#fd356e]" />
                    </div>
                    <span className="text-3xl font-bold text-white/5">{f.step}</span>
                  </div>
                  <h3 className="mb-2 text-lg font-medium text-white">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-zinc-400">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="relative py-28 px-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-40 bottom-0 h-[400px] w-[400px] rounded-full bg-[#fd356e]/8 blur-[100px]" />
        </div>
        <div className="container mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-sm font-medium text-[#fd356e] uppercase tracking-widest">
              {t("pricing.sectionLabel")}
            </p>
            <h2 className="text-4xl font-semibold">{t("pricing.title")}</h2>
            <p className="mt-3 text-zinc-400">{t("pricing.subtitle")}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl p-5 transition-all ${
                  plan.highlight
                    ? "border border-[#fd356e]/50 bg-gradient-to-b from-[#fd356e]/10 to-transparent shadow-xl shadow-[#fd356e]/10"
                    : "border border-white/[0.06] bg-white/[0.02]"
                } ${plan.agency ? "opacity-60" : ""}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#fd356e] px-3 py-0.5 text-xs font-medium text-white">
                    {t("pricing.plans.pro.badge")}
                  </div>
                )}
                <div className="mb-5">
                  <p className="text-sm font-medium text-zinc-400 mb-1">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-semibold">${plan.price}</span>
                    {plan.price !== "0" && <span className="text-zinc-500 text-sm">/mo</span>}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{plan.description}</p>
                </div>
                <ul className="mb-6 flex-1 space-y-2">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2 text-sm text-zinc-300">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#fd356e]" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.agency ? "#" : "/register"}
                  className={`flex items-center justify-center rounded-xl py-2.5 text-sm font-medium transition-all ${
                    plan.highlight
                      ? "bg-[#fd356e] text-white hover:bg-[#ff5a84] shadow-lg shadow-[#fd356e]/20"
                      : plan.agency
                      ? "border border-white/10 text-zinc-500 cursor-not-allowed"
                      : "border border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-28 px-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-[#fd356e]/8 blur-[100px]" />
        </div>
        <div className="container mx-auto max-w-2xl text-center relative">
          <h2 className="text-4xl font-semibold mb-4">{t("cta.title")}</h2>
          <p className="text-zinc-400 mb-8 text-lg font-light">{t("cta.subtitle")}</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-[#fd356e] px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-[#fd356e]/25 hover:bg-[#ff5a84] transition-all"
          >
            {t("cta.button")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] py-8 px-5">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 text-sm text-zinc-600 sm:flex-row">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#fd356e]/50" />
            <span>SEOBrief</span>
          </div>
          <p>{t("footer.copyright")}</p>
        </div>
      </footer>
    </div>
  );
}

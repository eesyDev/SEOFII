import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Search, BarChart2, FileText, Check, Zap } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Топ-10 конкурентов",
    description: "Автоматически анализируем выдачу по твоему URL через DataForSEO",
  },
  {
    icon: BarChart2,
    title: "Ключевые слова",
    description: "Объём, CPC, конкуренция — все данные собраны и структурированы",
  },
  {
    icon: FileText,
    title: "Готовое ТЗ",
    description: "Claude AI генерирует детальный бриф для копирайтера за секунды",
  },
];

const plans = [
  {
    name: "Free",
    price: "0",
    reports: "3 отчёта",
    description: "Попробуй без рисков",
    highlight: false,
    perks: ["3 отчёта в месяц", "Базовый анализ", "Email поддержка"],
  },
  {
    name: "Starter",
    price: "19",
    reports: "30 отчётов / мес",
    description: "Для SEO-специалистов",
    highlight: true,
    perks: ["30 отчётов в месяц", "Полный анализ конкурентов", "Экспорт в PDF", "Приоритетная поддержка"],
  },
  {
    name: "Pro",
    price: "49",
    reports: "Безлимит",
    description: "Для агентств и команд",
    highlight: false,
    perks: ["Безлимитные отчёты", "API доступ", "Командный доступ", "White-label отчёты"],
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Навигация */}
      <header className="border-b sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="text-xl font-bold">SEOBrief</span>
            <Badge variant="secondary" className="text-xs">Beta</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm">Войти</Button>
            <Button size="sm">Начать бесплатно</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-28 text-center">
        <Badge variant="outline" className="mb-6 gap-1.5">
          <Zap className="h-3 w-3" />
          Powered by Claude AI + DataForSEO
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight mb-6 max-w-3xl mx-auto leading-tight">
          Готовое SEO-ТЗ для копирайтера{" "}
          <span className="text-muted-foreground">за одну минуту</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
          Вставь URL страницы — получи анализ топ-10 конкурентов, ключевые слова
          и детальное техническое задание на оптимизацию.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button size="lg" className="text-base px-8">
            Попробовать бесплатно
          </Button>
          <Button size="lg" variant="outline" className="text-base px-8">
            Смотреть пример
          </Button>
        </div>
      </section>

      <Separator />

      {/* Фичи */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-3">Как это работает</h2>
        <p className="text-muted-foreground text-center mb-12">Три шага — и ТЗ готово</p>
        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
          {features.map((f, i) => (
            <Card key={f.title}>
              <CardHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Шаг {i + 1}</span>
                </div>
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {f.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* Тарифы */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-3">Тарифы</h2>
        <p className="text-muted-foreground text-center mb-12">
          Начни бесплатно, масштабируй по мере роста
        </p>
        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto items-start">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.highlight ? "border-primary shadow-lg ring-1 ring-primary" : ""}
            >
              <CardHeader>
                {plan.highlight && (
                  <Badge className="w-fit mb-2 text-xs">Популярный</Badge>
                )}
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  {plan.price !== "0" && (
                    <span className="text-muted-foreground text-sm">/мес</span>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                >
                  {plan.price === "0" ? "Начать бесплатно" : "Выбрать план"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          © 2025 SEOBrief. Все права защищены.
        </div>
      </footer>
    </div>
  );
}

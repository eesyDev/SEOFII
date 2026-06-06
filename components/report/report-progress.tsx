"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const STEPS = [
  { label: "Анализируем страницу", duration: 8 },
  { label: "Собираем конкурентов из выдачи", duration: 12 },
  { label: "Скрапим сайты конкурентов", duration: 15 },
  { label: "Получаем данные по ключевым словам", duration: 10 },
  { label: "Замеряем скорость страниц", duration: 20 },
  { label: "Генерируем SEO-бриф через Claude", duration: 35 },
  { label: "Анализируем структуру через Gemini", duration: 12 },
  { label: "Формируем рекомендации", duration: 15 },
];

export function ReportProgress() {
  const [elapsed, setElapsed] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let acc = 0;
    for (let i = 0; i < STEPS.length; i++) {
      acc += STEPS[i].duration;
      if (elapsed < acc) {
        setCurrentStep(i);
        return;
      }
    }
    setCurrentStep(STEPS.length - 1);
  }, [elapsed]);

  const totalDuration = STEPS.reduce((s, st) => s + st.duration, 0);
  const progress = Math.min((elapsed / totalDuration) * 100, 95);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeLabel = minutes > 0
    ? `${minutes}м ${seconds}с`
    : `${seconds}с`;

  return (
    <div className="space-y-6 py-4">
      {/* Прогресс-бар */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Генерируем отчёт...</span>
          <span>{timeLabel}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Шаги */}
      <div className="space-y-2.5">
        {STEPS.map((step, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;
          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 text-sm transition-opacity duration-500 ${
                isDone ? "opacity-40" : isActive ? "opacity-100" : "opacity-20"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 shrink-0 text-primary animate-spin" />
              ) : (
                <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
              )}
              <span className={isActive ? "font-medium" : ""}>{step.label}</span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Страница обновится автоматически когда отчёт будет готов
      </p>
    </div>
  );
}

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

const TOTAL = STEPS.reduce((s, st) => s + st.duration, 0);

interface Props {
  startedAt: string; // ISO timestamp отчёта из БД
}

export function ReportProgress({ startedAt }: Props) {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  let acc = 0;
  let currentStep = STEPS.length - 1;
  for (let i = 0; i < STEPS.length; i++) {
    acc += STEPS[i].duration;
    if (elapsed < acc) { currentStep = i; break; }
  }

  const progress = Math.min((elapsed / TOTAL) * 100, 95);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeLabel = minutes > 0 ? `${minutes}м ${seconds}с` : `${seconds}с`;

  return (
    <div className="space-y-6 py-4">
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

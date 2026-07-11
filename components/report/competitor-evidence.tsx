"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Quote } from "lucide-react";
import type { CompetitorEvidence } from "@/lib/competitorEvidence";

const BLOCK_LABEL: Record<string, string> = {
  reviews: "Отзывы",
  faq: "FAQ",
  video: "Видео",
  price: "Цены",
  comparison_table: "Таблица",
  gallery: "Галерея",
  social_proof: "Соцдоказательства",
  team: "Команда",
  map: "Карта",
  calculator: "Калькулятор",
  chat: "Чат",
  form: "Форма",
  portfolio: "Портфолио",
  cases: "Кейсы",
  certificates: "Сертификаты",
};

function EvidenceCard({ evidence }: { evidence: CompetitorEvidence }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
            #{evidence.position}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{evidence.domain}</p>
            <p className="text-xs text-muted-foreground truncate">
              {evidence.wordCount.toLocaleString("ru-RU")} слов · {evidence.headings.length} заголовков
              {evidence.faqQuestions.length > 0 && ` · FAQ: ${evidence.faqQuestions.length} вопросов`}
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground ml-2" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground ml-2" />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Title</p>
            <p className="font-medium">«{evidence.title}»</p>
            {evidence.h1 && evidence.h1 !== evidence.title && (
              <>
                <p className="text-xs text-muted-foreground mb-1 mt-2">H1</p>
                <p className="font-medium">«{evidence.h1}»</p>
              </>
            )}
          </div>

          {evidence.detectedBlocks.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Блоки на странице</p>
              <div className="flex flex-wrap gap-1.5">
                {evidence.detectedBlocks.map((b) => (
                  <span key={b} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {BLOCK_LABEL[b] ?? b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {evidence.faqQuestions.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Вопросы их FAQ — дословно</p>
              <ul className="space-y-1">
                {evidence.faqQuestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Quote className="h-3 w-3 text-muted-foreground mt-1 shrink-0" />
                    «{q}»
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evidence.priceMentions.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Цены в их тексте — дословно</p>
              <ul className="space-y-1">
                {evidence.priceMentions.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-muted-foreground">
                    <Quote className="h-3 w-3 mt-1 shrink-0" />
                    «…{p}…»
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evidence.headings.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Их структура заголовков</p>
              <ol className="space-y-0.5 text-muted-foreground">
                {evidence.headings.map((h, i) => (
                  <li key={i} className="truncate" title={h}>
                    {i + 1}. {h}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CompetitorEvidenceSection({ evidence }: { evidence: CompetitorEvidence[] }) {
  if (evidence.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Quote className="h-4 w-4" /> Дословно у конкурентов
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Не пересказ, а факты с их страниц: заголовки, вопросы FAQ, цены. Открой конкурента и посмотри, что копировать по смыслу.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {evidence.map((e, i) => (
          <EvidenceCard key={i} evidence={e} />
        ))}
      </CardContent>
    </Card>
  );
}

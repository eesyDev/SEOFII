"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Copy, FileCode, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { ReadyContent } from "@/lib/claude";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
    >
      {copied ? (
        <><Check className="h-3.5 w-3.5 text-green-500" /><span className="text-green-500">Скопировано</span></>
      ) : (
        <><Copy className="h-3.5 w-3.5" /><span>Копировать</span></>
      )}
    </button>
  );
}

function ContentRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <CopyButton text={value} />
      </div>
      <p className={`text-sm leading-relaxed ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</p>
    </div>
  );
}

function CharCount({ text, limit }: { text: string; limit: number }) {
  const n = text.length;
  const over = n > limit;
  return (
    <span className={`text-[10px] tabular-nums ${over ? "text-red-500" : "text-muted-foreground"}`}>
      {n}/{limit}
    </span>
  );
}

interface Props {
  readyContent: ReadyContent;
}

export function ReadyContentSection({ readyContent }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Готовый контент — скопируй и вставь
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Все тексты оптимизированы под ключевой запрос и готовы к публикации
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Title */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</p>
              <CharCount text={readyContent.title} limit={60} />
            </div>
            <CopyButton text={readyContent.title} />
          </div>
          <p className="text-sm font-medium">{readyContent.title}</p>
        </div>

        {/* H1 */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">H1</p>
              <CharCount text={readyContent.h1} limit={70} />
            </div>
            <CopyButton text={readyContent.h1} />
          </div>
          <p className="text-sm font-medium">{readyContent.h1}</p>
        </div>

        {/* Meta description */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Meta Description</p>
              <CharCount text={readyContent.metaDescription} limit={155} />
            </div>
            <CopyButton text={readyContent.metaDescription} />
          </div>
          <p className="text-sm">{readyContent.metaDescription}</p>
        </div>

        {/* Intro */}
        <ContentRow label="Первый абзац" value={readyContent.introParagraph} />

        {/* FAQ */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">FAQ — 5 вопросов и ответов</p>
            <CopyButton text={readyContent.faqItems.map((f) => `В: ${f.question}\nО: ${f.answer}`).join("\n\n")} />
          </div>
          <div className="space-y-2">
            {readyContent.faqItems.map((item, i) => (
              <div key={i} className="border-l-2 border-primary/30 pl-3 space-y-0.5">
                <p className="text-sm font-medium">{item.question}</p>
                <p className="text-sm text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Schema markup */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Schema.org JSON-LD</p>
            </div>
            <CopyButton text={`<script type="application/ld+json">\n${readyContent.schemaMarkup}\n</script>`} />
          </div>
          <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto">
            {readyContent.schemaMarkup}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReadyContentLocked() {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Готовый контент — скопируй и вставь
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Blurred preview */}
        <div className="space-y-3 blur-sm pointer-events-none select-none">
          {["Title", "H1", "Meta Description", "Первый абзац"].map((label) => (
            <div key={label} className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          ))}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">FAQ</p>
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-l-2 border-primary/30 pl-3 space-y-1">
                <div className="h-3.5 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <div className="text-center space-y-3 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mx-auto">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Готовый контент для Pro</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                Title, H1, meta description, первый абзац, FAQ и schema.org — всё готово к копипасту
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href="/billing">Перейти на Pro</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

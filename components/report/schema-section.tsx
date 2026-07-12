"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Code2 } from "lucide-react";
import type { SchemaResult } from "@/lib/claude";

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

// Объединяет все блоки в один JSON-LD с общим @graph — вставляется одним скриптом
function buildCombinedSchema(schemas: SchemaResult["schemas"]): string | null {
  try {
    const nodes: unknown[] = [];
    for (const s of schemas) {
      const parsed = JSON.parse(s.code);
      if (Array.isArray(parsed["@graph"])) nodes.push(...parsed["@graph"]);
      else nodes.push(parsed);
    }
    return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }, null, 2);
  } catch {
    return null;
  }
}

export function SchemaSection({ schemaResult }: { schemaResult: SchemaResult }) {
  if (!schemaResult?.schemas?.length) return null;

  const combined = buildCombinedSchema(schemaResult.schemas);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Code2 className="h-4 w-4" /> Schema.org разметка
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Готовый JSON-LD — вставь в <code className="bg-muted px-1 rounded">&lt;head&gt;</code> страницы
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {combined && (
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge className="font-mono text-xs">Всё одним блоком</Badge>
                <p className="text-xs text-muted-foreground">
                  Вся разметка в одном скрипте — достаточно вставить только его
                </p>
              </div>
              <CopyButton text={`<script type="application/ld+json">\n${combined}\n</script>`} />
            </div>
            <details>
              <summary className="text-xs text-muted-foreground cursor-pointer select-none">Показать код</summary>
              <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto bg-background rounded p-2 border">
                {`<script type="application/ld+json">\n${combined}\n</script>`}
              </pre>
            </details>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Или по частям — если нужна только конкретная разметка:
        </p>
        {schemaResult.schemas.map((schema, i) => (
          <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">{schema.type}</Badge>
                <p className="text-xs text-muted-foreground">{schema.description}</p>
              </div>
              <CopyButton text={`<script type="application/ld+json">\n${schema.code}\n</script>`} />
            </div>
            <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto bg-background rounded p-2 border">
              {`<script type="application/ld+json">\n${schema.code}\n</script>`}
            </pre>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

"use client";

import { useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, PlusCircle, Layers } from "lucide-react";
import type { PageStructureAnalysis } from "@/lib/gemini";

const PRIORITY_LABEL = { high: "Высокий", medium: "Средний", low: "Низкий" } as const;
const PRIORITY_LABEL_EN = { high: "High", medium: "Medium", low: "Low" } as const;
const PRIORITY_VARIANT = { high: "destructive", medium: "secondary", low: "outline" } as const;

export function PageStructureSection({ pageStructure }: { pageStructure: PageStructureAnalysis }) {
  const en = useLocale() === "en";
  const { existingBlocks, recommendedBlocks, summary } = pageStructure;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4" /> {en ? "AI view of your page" : "Взгляд AI на вашу страницу"}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          {en ? "Analysis of this exact page: what exists and what\u2019s missing." : "Разбор именно этой страницы: что уже есть и чего не хватает."}
          {summary ? ` ${summary}` : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Что есть */}
        {existingBlocks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{en ? "Already on the page" : "Уже есть на странице"}</p>
            <div className="flex flex-wrap gap-2">
              {existingBlocks.map((block, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1">
                  <CheckCircle2 className="h-3 w-3" /> {block}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Что добавить */}
        {recommendedBlocks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{en ? "Recommended to add" : "Рекомендуем добавить"}</p>
            <div className="space-y-2">
              {recommendedBlocks.map((block, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
                  <PlusCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{block.name}</p>
                      <Badge variant={PRIORITY_VARIANT[block.priority]} className="text-[10px] px-1.5 py-0">
                        {en ? PRIORITY_LABEL_EN[block.priority] : PRIORITY_LABEL[block.priority]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{block.rationale}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

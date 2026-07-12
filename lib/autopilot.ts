// SEO Autopilot Engine
// Coordinates: site sync → AI analysis → change generation → approval → apply → monitor

import { prisma } from "./prisma";
import { syncWPSite, updateWPPage, updateYoastMeta, type WPCredentials } from "./wordpress";
import { scrapePages } from "./scraper";
import { fetchCompetitors, fetchKeywords, type SerpResult } from "./dataforseo";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────
// 1. SYNC SITE PAGES
// ─────────────────────────────────────────

export async function syncSitePages(siteId: string) {
  const site = await prisma.siteConnection.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Site not found");
  if (site.type !== "WORDPRESS") throw new Error("Only WordPress supported for autopilot");

  const creds = site.credentials as unknown as WPCredentials;
  const synced = await syncWPSite(site.url, creds);

  for (const page of synced) {
    await prisma.sitePage.upsert({
      where: { siteId_url: { siteId, url: page.url } },
      update: {
        wpId: page.wpId,
        title: page.title,
        content: page.content,
        excerpt: page.excerpt,
        status: page.status,
        type: page.type,
        modifiedAt: page.modifiedAt,
      },
      create: {
        siteId,
        wpId: page.wpId,
        url: page.url,
        title: page.title,
        content: page.content,
        excerpt: page.excerpt,
        status: page.status,
        type: page.type,
        modifiedAt: page.modifiedAt,
      },
    });
  }

  await prisma.siteConnection.update({
    where: { id: siteId },
    data: { lastSyncAt: new Date() },
  });

  return { synced: synced.length };
}

// ─────────────────────────────────────────
// 2. CREATE AUTOPILOT JOB → ANALYZE → GENERATE CHANGES
// ─────────────────────────────────────────

export async function createAutopilotJob(siteId: string) {
  const site = await prisma.siteConnection.findUnique({
    where: { id: siteId },
    include: { pages: true, config: true },
  });
  if (!site) throw new Error("Site not found");

  await syncSitePages(siteId);

  const job = await prisma.autoPilotJob.create({
    data: { siteId, status: "ANALYZING" },
  });

  const freshPages = await prisma.sitePage.findMany({
    where: { siteId, status: "publish" },
    take: 10,
    orderBy: { updatedAt: "desc" },
  });

  let totalChanges = 0;
  const changes: Array<{
    pageUrl: string;
    wpPostId: number | null;
    field: string;
    oldValue: string | null;
    newValue: string;
    aiReasoning: string;
    instruction: string;
    missingElements: object;
    evidence: object;
    confidence: number;
  }> = [];

  for (const page of freshPages) {
    if (!page.wpId) continue;
    try {
      const pageChanges = await analyzePageForAutopilot(site, page);
      changes.push(...pageChanges);
    } catch (err) {
      console.warn(`[autopilot] Failed to analyze ${page.url}:`, err);
    }
  }

  if (changes.length > 0) {
    await prisma.autoPilotChange.createMany({
      data: changes.map((c) => ({
        jobId: job.id,
        pageUrl: c.pageUrl,
        wpPostId: c.wpPostId,
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
        aiReasoning: c.aiReasoning,
        instruction: c.instruction,
        missingElements: c.missingElements as any,
        evidence: c.evidence as any,
        confidence: c.confidence,
        status: "PENDING" as const,
      })),
    });
    totalChanges = changes.length;
  }

  const updatedJob = await prisma.autoPilotJob.update({
    where: { id: job.id },
    data: {
      status: totalChanges > 0 ? "CHANGES_READY" : "DONE",
      pageCount: freshPages.length,
      changeCount: totalChanges,
      result: { changesGenerated: totalChanges, pagesAnalyzed: freshPages.length },
    },
    include: { changes: true },
  });

  return updatedJob;
}

// ─────────────────────────────────────────
// 3. AI ANALYSIS FOR SINGLE PAGE — NON-GENERIC
// ─────────────────────────────────────────

async function analyzePageForAutopilot(
  site: Awaited<ReturnType<typeof prisma.siteConnection.findUnique>> & { pages: any[] },
  page: { url: string; wpId: number | null; title: string | null; content: string | null }
) {
  // Scrape target + competitors in parallel
  const { target } = await scrapePages(page.url, []);

  let serpCompetitors: SerpResult[] = [];
  try {
    serpCompetitors = await fetchCompetitors(page.url, 2840);
  } catch {
    // If SERP fails, we can still do basic analysis but will be less specific
  }

  // Scrape top 3 competitor pages for REAL data (not just SERP snippets)
  const topUrls = serpCompetitors.slice(0, 3).map((c) => c.url);
  let compSnapshots: import("./scraper").PageSnapshot[] = [];
  if (topUrls.length > 0) {
    try {
      const scrapeResult = await scrapePages(page.url, topUrls);
      compSnapshots = scrapeResult.competitors;
    } catch {
      // If scraping fails, fall back to SERP-only data
    }
  }

  // Fetch keyword volumes from competitor titles
  const rawKeywords = serpCompetitors
    .flatMap((c) => c.title.toLowerCase().split(/\s+/))
    .filter((w) => w.length > 3);
  const uniqueKeywords = [...new Set(rawKeywords)].slice(0, 20);

  let keywordData: import("./dataforseo").KeywordData[] = [];
  if (uniqueKeywords.length > 0) {
    try {
      keywordData = await fetchKeywords(uniqueKeywords, 2840);
    } catch {
      // Keywords are nice-to-have, not blocking
    }
  }

  // Build competitor comparison matrix with REAL scraped data
  const competitorRows = serpCompetitors.slice(0, 3).map((comp, i) => {
    const snap = compSnapshots[i];
    if (snap && !snap.fetchError) {
      return {
        domain: comp.domain,
        position: comp.position,
        title: snap.title,
        metaDescription: snap.metaDescription,
        wordCount: snap.wordCount,
        headings: snap.headings,
        headingsCount: snap.headings.length,
        hasSchema: snap.hasSchema,
        schemaTypes: snap.schemaTypes,
        detectedBlocks: snap.detectedBlocks,
        internalLinks: snap.internalLinksCount,
      };
    }
    // Fallback to SERP-only data
    return {
      domain: comp.domain,
      position: comp.position,
      title: comp.title,
      metaDescription: "",
      wordCount: null,
      headings: [],
      headingsCount: null,
      hasSchema: false,
      schemaTypes: [],
      detectedBlocks: [],
      internalLinks: null,
    };
  });

  // If we have no real competitor data at all, skip analysis
  if (competitorRows.length === 0) {
    return [];
  }

  // Build the prompt with MAXIMUM concrete data
  const keywordsBlock = keywordData.length > 0
    ? keywordData
        .filter((k) => k.volume > 0)
        .map((k) => `  "${k.keyword}": ${k.volume}/mo searches, $${k.cpc} CPC`)
        .join("\n")
    : "  (no keyword volume data available)";

  const comparisonTable = competitorRows
    .map((c) => {
      const lines = [
        `COMPETITOR #${c.position}: ${c.domain}`,
        `  Title: "${c.title}"`,
        c.metaDescription ? `  Meta: "${c.metaDescription}"` : "",
        c.wordCount !== null ? `  Word count: ${c.wordCount}` : "",
        c.headingsCount !== null ? `  Headings: ${c.headingsCount} (${c.headings.slice(0, 5).join(" | ")})` : "",
        c.detectedBlocks.length > 0 ? `  Blocks: ${c.detectedBlocks.join(", ")}` : "",
        c.hasSchema ? `  Schema: ${c.schemaTypes.join(", ")}` : "  Schema: none",
        c.internalLinks !== null ? `  Internal links: ${c.internalLinks}` : "",
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n");

  const targetBlock = [
    `YOUR PAGE: ${page.url}`,
    `  Title: "${target.title || "MISSING"}"`,
    `  Meta: "${target.metaDescription || "MISSING"}"`,
    `  H1: "${target.h1 || "MISSING"}"`,
    `  Word count: ${target.wordCount}`,
    `  Headings: ${target.headings.length} (${target.headings.slice(0, 5).join(" | ")})`,
    `  Blocks: ${target.detectedBlocks.join(", ") || "none detected"}`,
    `  Schema: ${target.schemaTypes.join(", ") || "none"}`,
    `  Internal links: ${target.internalLinksCount}`,
  ].join("\n");

  const prompt = `You are an elite SEO analyst. Your job is to COMPARE the user's page with competitor pages and identify SPECIFIC MISSING ELEMENTS.

CRITICAL — You do NOT write new text from scratch. You only identify what is MISSING and cite the exact competitor example.

RULES (violation = rejection):
1. instruction must start with action word: "Добавьте", "Удалите", "Замените", "Переместите"
2. Every missingElement MUST have a real example from a specific competitor
3. reasoning MUST cite competitor domain + specific metric (e.g. "sofas.com title has 58 chars vs your 23")
4. suggestedNewValue = user's current text + missing elements mechanically appended (do not rewrite)
5. NO generic phrases: "improve SEO", "better ranking", "optimize", "enhance visibility", "boost traffic"
6. If no clear missing elements — output EMPTY array

${targetBlock}

${comparisonTable}

KEYWORDS WITH SEARCH VOLUME:
${keywordsBlock}

OUTPUT FORMAT — JSON array. Each object:
- field: "title" or "meta_description"
- instruction: what to do (e.g. "Добавьте цену и количество в title")
- missingElements: array of { element, example, competitorDomain }
- suggestedNewValue: mechanical combination (current + missing elements)
- reasoning: one sentence with competitor + metric
- evidence: { competitorDomain, metricBefore, metricAfter, source }
- confidence: 0-100

GOOD example:
{
  "field": "title",
  "instruction": "Добавьте цену и количество моделей в title",
  "missingElements": [
    { "element": "цена", "example": "от 15 000 ₽", "competitorDomain": "sofas.com" },
    { "element": "количество", "example": "500 моделей", "competitorDomain": "divan.ru" }
  ],
  "suggestedNewValue": "Купить диваны в Москве — 500 моделей от 15 000 ₽",
  "reasoning": "sofas.com (позиция #1) и divan.ru (позиция #2) включают цену и количество; их title 58 символов vs ваших 23",
  "evidence": { "competitorDomain": "sofas.com, divan.ru", "metricBefore": "23 символа", "metricAfter": "58 символов", "source": "scraped competitor titles" },
  "confidence": 92
}

BAD example (rejected):
{
  "field": "title",
  "instruction": "Improve your title for better SEO",
  "missingElements": [],
  "suggestedNewValue": "Best Sofas 2026 | Quality Furniture Store",
  "reasoning": "This title will help you rank higher in search results",
  "evidence": {},
  "confidence": 60
}

ANALYZE AND OUTPUT:`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  let aiChanges: Array<{
    field: string;
    instruction: string;
    missingElements: Array<{ element: string; example: string; competitorDomain: string }>;
    suggestedNewValue: string;
    reasoning: string;
    evidence: object;
    confidence: number;
  }> = [];

  try {
    const parsed = JSON.parse(extractJson(text));
    if (Array.isArray(parsed)) {
      aiChanges = parsed.filter(isValidStructuralRecommendation);
    }
  } catch {
    aiChanges = [];
  }

  const result: Array<{
    pageUrl: string;
    wpPostId: number | null;
    field: string;
    oldValue: string | null;
    newValue: string;
    aiReasoning: string;
    instruction: string;
    missingElements: object;
    evidence: object;
    confidence: number;
  }> = [];

  for (const change of aiChanges) {
    const oldValue =
      change.field === "title"
        ? target.title || ""
        : change.field === "meta_description"
        ? target.metaDescription || ""
        : "";

    if (oldValue.trim() === change.suggestedNewValue.trim()) continue;

    result.push({
      pageUrl: page.url,
      wpPostId: page.wpId,
      field: change.field,
      oldValue: oldValue || null,
      newValue: change.suggestedNewValue,
      aiReasoning: change.reasoning,
      instruction: change.instruction,
      missingElements: change.missingElements,
      evidence: change.evidence,
      confidence: change.confidence,
    });
  }

  return result;
}

// ─────────────────────────────────────────
// VALIDATION: structural recommendations only
// ─────────────────────────────────────────

const GENERIC_PHRASES = [
  "improve seo", "better ranking", "optimize", "enhance visibility",
  "boost traffic", "increase ranking", "better performance", "seo friendly",
  "search engine", "rank higher", "improve position", "better results",
  "good for seo", "help ranking", "improve ctr", "more clicks",
];

const ACTION_WORDS = ["добавьте", "удалите", "замените", "переместите", "включите", "исключите", "добавь", "удали", "замени"];

function isValidStructuralRecommendation(item: any): boolean {
  if (!item || typeof item !== "object") return false;
  if (!item.field || !item.instruction || !item.reasoning) return false;

  // Must have missingElements array with real examples
  if (!Array.isArray(item.missingElements) || item.missingElements.length === 0) return false;
  for (const me of item.missingElements) {
    if (!me.element || !me.example || !me.competitorDomain) return false;
    if (!/\.[a-z]{2,6}/i.test(me.competitorDomain)) return false;
  }

  // instruction must start with action word
  const instructionLower = item.instruction.toLowerCase();
  const hasAction = ACTION_WORDS.some((w) => instructionLower.startsWith(w));
  if (!hasAction) return false;

  // reasoning must cite competitor domain
  const hasDomain = /\.[a-z]{2,6}/i.test(item.reasoning);
  if (!hasDomain) return false;

  // reasoning must contain a number
  const hasNumber = /\d/.test(item.reasoning);
  if (!hasNumber) return false;

  // No generic phrases
  const reasoningLower = item.reasoning.toLowerCase();
  const isGeneric = GENERIC_PHRASES.some((p) => reasoningLower.includes(p));
  if (isGeneric) return false;

  // Confidence
  const confidence = typeof item.confidence === "number" ? item.confidence : 0;
  if (confidence < 50) return false;

  return true;
}

function extractJson(text: string): string {
  const first = text.indexOf("[");
  const last = text.lastIndexOf("]");
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1);
  }
  const firstObj = text.indexOf("{");
  const lastObj = text.lastIndexOf("}");
  if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
    // If single object, wrap in array
    return `[${text.slice(firstObj, lastObj + 1)}]`;
  }
  return text;
}

// ─────────────────────────────────────────
// 4. APPLY CHANGE TO WORDPRESS
// ─────────────────────────────────────────

export async function applyChange(changeId: string) {
  const change = await prisma.autoPilotChange.findUnique({
    where: { id: changeId },
    include: { job: { include: { site: true } } },
  });
  if (!change) throw new Error("Change not found");
  if (change.status !== "PENDING" && change.status !== "APPROVED") {
    throw new Error(`Cannot apply change with status ${change.status}`);
  }

  const site = change.job.site;
  const creds = site.credentials as unknown as WPCredentials;

  if (!change.wpPostId) {
    throw new Error("Cannot apply change: no WordPress post ID");
  }

  const pageRecord = await prisma.sitePage.findFirst({
    where: { siteId: site.id, url: change.pageUrl },
  });
  const wpType = pageRecord?.type === "post" ? "posts" : "pages";

  try {
    if (change.field === "title") {
      await updateWPPage(site.url, creds, change.wpPostId, wpType, {
        title: change.newValue,
      });
    } else if (change.field === "meta_description") {
      const yoastOk = await updateYoastMeta(site.url, creds, change.wpPostId, wpType, {
        description: change.newValue,
      });

      if (!yoastOk) {
        await updateWPPage(site.url, creds, change.wpPostId, wpType, {
          excerpt: change.newValue,
        });
      }
    }

    // Фиксируем позицию «до»: GSC-данные отстают на ~3 дня, так что замер
    // в момент применения отражает состояние ДО правки. «После» замерит крон через 7 дней.
    const { gscAvgPosition } = await import("./cronJobs");
    const rankingBefore = await gscAvgPosition(site.userId, change.pageUrl);

    await prisma.autoPilotChange.update({
      where: { id: changeId },
      data: { status: "APPLIED", appliedAt: new Date(), rankingBefore },
    });

    if (pageRecord) {
      await prisma.sitePage.update({
        where: { id: pageRecord.id },
        data: {
          title: change.field === "title" ? change.newValue : undefined,
          excerpt: change.field === "meta_description" ? change.newValue : undefined,
          modifiedAt: new Date(),
        },
      });
    }

    return { success: true, changeId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Failed to apply change: ${message}`);
  }
}

// ─────────────────────────────────────────
// 5. ROLLBACK CHANGE
// ─────────────────────────────────────────

export async function rollbackChange(changeId: string) {
  const change = await prisma.autoPilotChange.findUnique({
    where: { id: changeId },
    include: { job: { include: { site: true } } },
  });
  if (!change) throw new Error("Change not found");
  if (change.status !== "APPLIED") {
    throw new Error("Can only rollback applied changes");
  }
  if (!change.oldValue) {
    throw new Error("Cannot rollback: no previous value stored");
  }

  const site = change.job.site;
  const creds = site.credentials as unknown as WPCredentials;

  if (!change.wpPostId) {
    throw new Error("Cannot rollback: no WordPress post ID");
  }

  const pageRecord = await prisma.sitePage.findFirst({
    where: { siteId: site.id, url: change.pageUrl },
  });
  const wpType = pageRecord?.type === "post" ? "posts" : "pages";

  try {
    if (change.field === "title") {
      await updateWPPage(site.url, creds, change.wpPostId, wpType, {
        title: change.oldValue,
      });
    } else if (change.field === "meta_description") {
      await updateYoastMeta(site.url, creds, change.wpPostId, wpType, {
        description: change.oldValue,
      });
    }

    await prisma.autoPilotChange.update({
      where: { id: changeId },
      data: { status: "ROLLED_BACK", rolledBackAt: new Date() },
    });

    if (pageRecord) {
      await prisma.sitePage.update({
        where: { id: pageRecord.id },
        data: {
          title: change.field === "title" ? change.oldValue : undefined,
          excerpt: change.field === "meta_description" ? change.oldValue : undefined,
          modifiedAt: new Date(),
        },
      });
    }

    return { success: true, changeId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Failed to rollback change: ${message}`);
  }
}

// ─────────────────────────────────────────
// 6. BULK OPERATIONS
// ─────────────────────────────────────────

export async function approveAllPending(jobId: string) {
  const changes = await prisma.autoPilotChange.findMany({
    where: { jobId, status: "PENDING" },
  });

  await prisma.autoPilotChange.updateMany({
    where: { jobId, status: "PENDING" },
    data: { status: "APPROVED" },
  });

  return { approved: changes.length };
}

export async function applyAllApproved(jobId: string) {
  const changes = await prisma.autoPilotChange.findMany({
    where: { jobId, status: "APPROVED" },
  });

  const results: Array<{ changeId: string; success: boolean; error?: string }> = [];

  for (const change of changes) {
    try {
      await applyChange(change.id);
      results.push({ changeId: change.id, success: true });
    } catch (err) {
      results.push({
        changeId: change.id,
        success: false,
        error: err instanceof Error ? err.message : "Unknown",
      });
    }
  }

  return results;
}

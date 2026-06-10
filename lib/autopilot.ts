// SEO Autopilot Engine
// Coordinates: site sync → AI analysis → change generation → approval → apply → monitor

import { prisma } from "./prisma";
import { syncWPSite, updateWPPage, fetchYoastMeta, updateYoastMeta, type WPCredentials } from "./wordpress";
import { scrapePages } from "./scraper";
import { fetchCompetitors } from "./dataforseo";
import { generateSEOBrief, generateReadyContent } from "./claude";
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

  // Upsert pages
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

  // 1. Sync latest pages
  await syncSitePages(siteId);

  // 2. Create job
  const job = await prisma.autoPilotJob.create({
    data: { siteId, status: "ANALYZING" },
  });

  // 3. Re-fetch pages after sync (was stale)
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
  }> = [];

  for (const page of freshPages) {
    if (!page.wpId) continue; // skip pages without WordPress ID
    try {
      const pageChanges = await analyzePageForAutopilot(site, page);
      changes.push(...pageChanges);
    } catch (err) {
      console.warn(`[autopilot] Failed to analyze ${page.url}:`, err);
    }
  }

  // 4. Save changes
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
        status: "PENDING" as const,
      })),
    });
    totalChanges = changes.length;
  }

  // 5. Update job
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
// 3. AI ANALYSIS FOR SINGLE PAGE
// ─────────────────────────────────────────

async function analyzePageForAutopilot(
  site: Awaited<ReturnType<typeof prisma.siteConnection.findUnique>> & { pages: any[] },
  page: { url: string; wpId: number | null; title: string | null; content: string | null }
) {
  const changes: Array<{
    pageUrl: string;
    wpPostId: number | null;
    field: string;
    oldValue: string | null;
    newValue: string;
    aiReasoning: string;
  }> = [];

  // Scrape current page
  const { target } = await scrapePages(page.url, []);

  // Get competitors (or use cached)
  let competitors: import("./dataforseo").SerpResult[];
  try {
    competitors = await fetchCompetitors(page.url, 2840);
  } catch {
    // If DataForSEO fails, skip competitor analysis
    competitors = [];
  }

  // Use Claude to generate specific changes
  const prompt = `You are an SEO autopilot. Analyze this page and output ONLY specific, actionable changes.

PAGE URL: ${page.url}
CURRENT TITLE: ${target.title || "missing"}
CURRENT H1: ${target.h1 || "missing"}
CURRENT META DESCRIPTION: ${target.metaDescription || "missing"}
WORD COUNT: ${target.wordCount}
HEADINGS: ${target.headings.join(" | ") || "none"}
${competitors.length > 0 ? `TOP COMPETITORS:\n${competitors.slice(0, 3).map((c, i) => `${i + 1}. ${c.title} (${c.domain})`).join("\n")}` : ""}

RULES:
- Output ONLY a JSON array of changes
- Each change must have: field ("title" or "meta_description"), newValue, reasoning
- Title must be ≤ 60 characters
- Meta description must be ≤ 155 characters
- reasoning must be 1 sentence explaining WHY this change will improve SEO
- Only suggest changes that are MEASURABLY better than current
- If current title/meta are already good, output empty array

OUTPUT FORMAT:
[
  { "field": "title", "newValue": "...", "reasoning": "..." },
  { "field": "meta_description", "newValue": "...", "reasoning": "..." }
]`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  let aiChanges: Array<{ field: string; newValue: string; reasoning: string }> = [];
  try {
    const parsed = JSON.parse(extractJson(text));
    if (Array.isArray(parsed)) aiChanges = parsed;
  } catch {
    // If AI returns garbage, fall back to simple improvements
    aiChanges = generateFallbackChanges(target);
  }

  for (const change of aiChanges) {
    const oldValue =
      change.field === "title"
        ? target.title || ""
        : change.field === "meta_description"
        ? target.metaDescription || ""
        : "";

    // Skip if no real change
    if (oldValue.trim() === change.newValue.trim()) continue;

    changes.push({
      pageUrl: page.url,
      wpPostId: page.wpId,
      field: change.field,
      oldValue: oldValue || null,
      newValue: change.newValue,
      aiReasoning: change.reasoning,
    });
  }

  return changes;
}

function generateFallbackChanges(target: import("./scraper").PageSnapshot): Array<{
  field: string;
  newValue: string;
  reasoning: string;
}> {
  const changes: Array<{ field: string; newValue: string; reasoning: string }> = [];

  // Title: add power words if missing
  if (target.title && target.title.length < 40) {
    changes.push({
      field: "title",
      newValue: `${target.title} | Best Guide 2026`,
      reasoning: "Current title is too short; adding year and power word improves CTR",
    });
  }

  // Meta: generate if missing
  if (!target.metaDescription || target.metaDescription.length < 50) {
    const h1 = target.h1 || target.title || "This page";
    changes.push({
      field: "meta_description",
      newValue: `Learn everything about ${h1}. Expert tips, step-by-step guide, and proven strategies. Read now!`,
      reasoning: "Meta description is missing or too short; this improves click-through rate from search results",
    });
  }

  return changes;
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
    return text.slice(firstObj, lastObj + 1);
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

  // Determine page type (pages vs posts)
  const pageRecord = await prisma.sitePage.findFirst({
    where: { siteId: site.id, url: change.pageUrl },
  });
  const wpType = pageRecord?.type === "post" ? "posts" : "pages";

  try {
    // Apply via WordPress REST API
    if (change.field === "title") {
      await updateWPPage(site.url, creds, change.wpPostId, wpType, {
        title: change.newValue,
      });
    } else if (change.field === "meta_description") {
      // Try Yoast first, then fallback to excerpt as meta
      const yoastOk = await updateYoastMeta(site.url, creds, change.wpPostId, wpType, {
        description: change.newValue,
      });

      if (!yoastOk) {
        // Fallback: update excerpt (many themes use excerpt as meta description)
        await updateWPPage(site.url, creds, change.wpPostId, wpType, {
          excerpt: change.newValue,
        });
      }
    }

    // Mark as applied
    await prisma.autoPilotChange.update({
      where: { id: changeId },
      data: { status: "APPLIED", appliedAt: new Date() },
    });

    // Update page record
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

    // Update page record after rollback
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

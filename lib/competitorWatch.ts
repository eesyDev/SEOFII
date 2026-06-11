import * as cheerio from "cheerio";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export interface CompetitorSnapshot {
  title: string;
  wordCount: number;
  headings: string[];
  blocks: string[];
  contentHash: string;
  rawText: string;
}

export interface WatchDiff {
  changeType: string;
  summary: string;
  diff: Record<string, { before: string | number; after: string | number }>;
}

export async function scrapeCompetitorPage(url: string): Promise<CompetitorSnapshot> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; SEOBriefBot/1.0; +https://seobrief.io)",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, noscript").remove();

  const title = $("title").text().trim() || $("h1").first().text().trim();
  const rawText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;

  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text) headings.push(text);
  });

  const blocks: string[] = [];
  const blockSelectors = [
    "[class*='product']",
    "[class*='price']",
    "[class*='spec']",
    "[class*='feature']",
    "[class*='faq']",
    "[class*='review']",
    "[class*='gallery']",
    "[class*='video']",
    "table",
    "[itemtype]",
  ];
  blockSelectors.forEach((sel) => {
    if ($(sel).length > 0) blocks.push(sel.replace(/\[|\]/g, "").replace(/\*/g, ""));
  });

  const keyContent = `${title}|${headings.join("|")}|${wordCount}|${blocks.sort().join("|")}`;
  const contentHash = crypto.createHash("md5").update(keyContent).digest("hex");

  return { title, wordCount, headings, blocks, contentHash, rawText: rawText.slice(0, 15_000) };
}

export function diffSnapshots(
  before: CompetitorSnapshot,
  after: CompetitorSnapshot
): WatchDiff | null {
  if (before.contentHash === after.contentHash) return null;

  const diff: Record<string, { before: string | number; after: string | number }> = {};

  if (before.title !== after.title) {
    diff.title = { before: before.title, after: after.title };
  }

  const wcDelta = Math.abs(after.wordCount - before.wordCount);
  if (wcDelta > 50 || wcDelta / Math.max(before.wordCount, 1) > 0.1) {
    diff.wordCount = { before: before.wordCount, after: after.wordCount };
  }

  const addedHeadings = after.headings.filter((h) => !before.headings.includes(h));
  const removedHeadings = before.headings.filter((h) => !after.headings.includes(h));
  if (addedHeadings.length > 0) diff.headingsAdded = { before: "", after: addedHeadings.join(" | ") };
  if (removedHeadings.length > 0) diff.headingsRemoved = { before: removedHeadings.join(" | "), after: "" };

  const addedBlocks = after.blocks.filter((b) => !before.blocks.includes(b));
  const removedBlocks = before.blocks.filter((b) => !after.blocks.includes(b));
  if (addedBlocks.length > 0) diff.blocksAdded = { before: "", after: addedBlocks.join(", ") };
  if (removedBlocks.length > 0) diff.blocksRemoved = { before: removedBlocks.join(", "), after: "" };

  if (Object.keys(diff).length === 0) return null;

  const changeType = detectChangeType(diff);

  return { changeType, summary: "", diff };
}

function detectChangeType(diff: Record<string, unknown>): string {
  if (diff.title) return "title_changed";
  if (diff.blocksAdded && String(diff.blocksAdded).includes("price")) return "price_changed";
  if (diff.blocksAdded && String(diff.blocksAdded).includes("product")) return "product_added";
  if (diff.headingsAdded || diff.wordCount) return "content_updated";
  return "content_updated";
}

export async function generateChangeSummary(
  label: string,
  url: string,
  before: CompetitorSnapshot,
  after: CompetitorSnapshot,
  diff: Record<string, { before: string | number; after: string | number }>
): Promise<string> {
  const changes = Object.entries(diff)
    .map(([key, val]) => {
      if (val.before === "") return `Added ${key}: "${val.after}"`;
      if (val.after === "") return `Removed ${key}: "${val.before}"`;
      return `${key}: "${val.before}" → "${val.after}"`;
    })
    .join("\n");

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `You monitor competitor pages for an SEO tool. Summarize what changed on this competitor page in 2-3 sentences. Be specific and business-focused — what does this change mean strategically?

Competitor: ${label}
URL: ${url}
Word count: ${before.wordCount} → ${after.wordCount}

Changes detected:
${changes}

Write a clear, concise summary (2-3 sentences max). No fluff.`,
      },
    ],
  });

  return (msg.content[0] as { type: string; text: string }).text.trim();
}

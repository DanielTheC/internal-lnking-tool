import type { KeywordMapping } from "@/types";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findKeywordPositionsInBlock(
  text: string,
  keyword: string,
  matchMode: KeywordMapping["matchMode"]
): number[] {
  const escaped = escapeRegex(keyword);
  const pattern =
    matchMode === "exact" ? `\\b${escaped}\\b` : escaped;
  const regex = new RegExp(pattern, "gi");
  const positions: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    positions.push(match.index);
  }
  return positions;
}

/** 0 = boilerplate / thin; 1 = looks like editorial body copy. */
export function scoreParagraphContext(paragraph: string): number {
  const t = paragraph.trim();
  if (t.length < 20) return 0.15;

  const lower = t.toLowerCase();
  const words = t.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Breadcrumb trails: "Home / Women / Flat Sandals" or "Home > Sale > Shoes"
  const slashTrailSegments = t.split(/\s*\/\s*/).filter((s) => s.trim().length > 0);
  if (
    slashTrailSegments.length >= 2 &&
    slashTrailSegments.length <= 10 &&
    t.length <= 220 &&
    !/[.!?]\s+\w/.test(t)
  ) {
    const longestSeg = Math.max(...slashTrailSegments.map((s) => s.length));
    if (longestSeg <= 45) return 0.07;
  }
  const gtTrailSegments = t.split(/\s*>\s*/).filter((s) => s.trim().length > 0);
  if (
    gtTrailSegments.length >= 2 &&
    gtTrailSegments.length <= 10 &&
    t.length <= 220 &&
    /^[^>]+\s*(>\s*[^>]+)+$/.test(t.trim())
  ) {
    const longestGt = Math.max(...gtTrailSegments.map((s) => s.length));
    if (longestGt <= 45) return 0.07;
  }

  // E‑commerce PLP / facet UI blobs (e.g. "Refine by Product Type: Court Shoes…")
  if (/\brefine\s+by\b/i.test(lower)) return 0.06;
  if (/\bfilter\s+by\b/i.test(lower)) return 0.06;
  const refineRepeats = (lower.match(/\brefine\s+by\b/g) || []).length;
  if (refineRepeats >= 2) return 0.05;
  const productTypeRepeats = (lower.match(/\bproduct\s+type\s*:/g) || []).length;
  if (productTypeRepeats >= 2) return 0.06;
  if (
    productTypeRepeats >= 1 &&
    wordCount > 35 &&
    /\b(shoes?|bag|sandals?|boots?|trainers?|heels?)\b/i.test(lower)
  ) {
    const roughSent = t.split(/[.!?]+\s+/).filter((s) => s.trim().length > 15);
    if (roughSent.length <= 1) return 0.08;
  }

  const boilerplatePatterns = [
    /cookie(s)?\s+policy/,
    /privacy\s+(policy|notice)/,
    /terms\s+(of\s+)?(use|service|sale)/,
    /all rights reserved/,
    /subscribe\s+(to\s+)?(our\s+)?(newsletter|mailing)/,
    /sign\s+up\s+(for|to)/,
    /follow\s+us\s+on/,
    /©\s*\d{4}/,
    /we (use|value) cookies/,
    /gdpr|ccpa/,
    /manage\s+(your\s+)?(preferences|cookies)/,
    /newsletter\s+signup/,
    /free\s+delivery\s+on\s+all\s+orders/i
  ];
  if (boilerplatePatterns.some((r) => r.test(lower))) return 0.2;

  if (wordCount < 6) return 0.25;

  // Multiple sentences → more likely real copy
  const roughSentences = t.split(/[.!?]+\s+/).filter((s) => s.trim().length > 15);
  let s = 0.45;
  if (roughSentences.length >= 3) s = 0.88;
  else if (roughSentences.length === 2) s = 0.78;
  else if (roughSentences.length === 1 && wordCount >= 14) s = 0.72;
  else if (roughSentences.length === 1 && wordCount >= 8) s = 0.58;

  // Penalise very long unbroken blocks (often legal / TOC)
  if (wordCount > 500 && roughSentences.length < 4) s *= 0.7;

  // Slight boost for “article-like” length band
  if (wordCount >= 20 && wordCount <= 220) s = Math.min(1, s + 0.05);

  return Math.min(1, Math.max(0, s));
}

export type KeywordBlockContext = {
  /** Best snippet (from strongest paragraph that contains the keyword). */
  snippet: string;
  /** 0–1 quality of that paragraph. */
  contextQuality: number;
  /** Max quality among all matching paragraphs (for scoring). */
  bestMatchContextQuality: number;
};

/** Paragraphs at or above this score count as “editorial” for keyword opportunities. */
export const MIN_EDITORIAL_PARAGRAPH_SCORE = 0.42;

/**
 * Like {@link getKeywordContextFromBlocks}, but only considers paragraphs that look like
 * body copy — not facet filters, nav-like blobs, etc.
 */
export function getEditorialKeywordContext(
  blocks: string[],
  keyword: string,
  matchMode: KeywordMapping["matchMode"]
): KeywordBlockContext | null {
  const editorial = blocks.filter(
    (b) =>
      b.trim().length > 0 &&
      scoreParagraphContext(b) >= MIN_EDITORIAL_PARAGRAPH_SCORE
  );
  if (editorial.length === 0) return null;
  return getKeywordContextFromBlocks(editorial, keyword, matchMode);
}

function buildSnippetLocal(text: string, index: number, radius = 100): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = `…${snippet}`;
  if (end < text.length) snippet = `${snippet}…`;
  return snippet;
}

/**
 * Pick snippet and context scores from semantic blocks (e.g. &lt;p&gt; text).
 * Falls back to a single full-text block.
 */
export function getKeywordContextFromBlocks(
  blocks: string[],
  keyword: string,
  matchMode: KeywordMapping["matchMode"]
): KeywordBlockContext | null {
  const usable = blocks.filter((b) => b.trim().length > 0);
  if (usable.length === 0) return null;

  let bestForSnippet: { block: string; pos: number; q: number } | null =
    null;
  let bestMatchContextQuality = 0;

  for (const block of usable) {
    const positions = findKeywordPositionsInBlock(block, keyword, matchMode);
    if (positions.length === 0) continue;
    const q = scoreParagraphContext(block);
    bestMatchContextQuality = Math.max(bestMatchContextQuality, q);
    if (!bestForSnippet || q > bestForSnippet.q) {
      bestForSnippet = { block, pos: positions[0], q };
    }
  }

  if (!bestForSnippet) return null;

  return {
    snippet: buildSnippetLocal(bestForSnippet.block, bestForSnippet.pos),
    contextQuality: bestForSnippet.q,
    bestMatchContextQuality
  };
}

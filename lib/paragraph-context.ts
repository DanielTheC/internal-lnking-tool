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

  const words = t.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
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

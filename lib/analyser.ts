import type {
  KeywordMapping,
  OpportunityResult,
  OpportunityStatus,
  PageData
} from "@/types";
import { normaliseUrl, urlsEqual } from "./url";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findKeywordPositions(
  text: string,
  keyword: string,
  matchMode: KeywordMapping["matchMode"]
): number[] {
  const flags = "gi";
  const escaped = escapeRegex(keyword);
  const pattern =
    matchMode === "exact"
      ? `\\b${escaped}\\b`
      : escaped;
  const regex = new RegExp(pattern, flags);
  const positions: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    positions.push(match.index);
  }
  return positions;
}

function buildSnippet(text: string, index: number, radius = 80): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = `…${snippet}`;
  if (end < text.length) snippet = `${snippet}…`;
  return snippet;
}

function pageLinksToDestination(page: PageData, dest: string): boolean {
  return page.outgoingInternalLinks.some((href) => urlsEqual(href, dest));
}

function anchorsWithKeyword(
  page: PageData,
  keyword: string,
  dest: string
): {
  toDestination: boolean;
  toOther: boolean;
} {
  const lowerKeyword = keyword.toLowerCase();
  let toDestination = false;
  let toOther = false;

  for (const anchor of page.internalAnchors) {
    const hasKeyword = anchor.text.toLowerCase().includes(lowerKeyword);
    if (!hasKeyword) continue;
    if (urlsEqual(anchor.href, dest)) {
      toDestination = true;
    } else {
      toOther = true;
    }
  }

  return { toDestination, toOther };
}

function computeScore(args: {
  matchCount: number;
  path: string;
  hasExistingLinks: boolean;
  status: OpportunityStatus;
}): number {
  // Base on status
  let score =
    args.status === "Opportunity found"
      ? 3
      : args.status === "Linked to different URL"
      ? 2
      : 1;

  // Boost by number of occurrences (cap at +3)
  score += Math.min(args.matchCount, 3);

  // Slightly boost "content-looking" paths
  const lower = args.path.toLowerCase();
  if (lower.includes("/blog") || lower.includes("/guide") || lower.includes("/article")) {
    score += 2;
  } else if (lower.includes("/category") || lower.includes("/collections")) {
    score += 1;
  }

  // Penalise when there are already many links on the page
  if (args.hasExistingLinks) {
    score -= 1;
  }

  return Math.max(score, 1);
}

export function analysePagesForOpportunities(
  pages: PageData[],
  keywordMappings: KeywordMapping[]
): OpportunityResult[] {
  const results: OpportunityResult[] = [];

  const keywordToDestinations = new Map<string, Set<string>>();
  const groupToDestinations = new Map<string, Set<string>>();

  for (const mapping of keywordMappings) {
    const dest = normaliseUrl(mapping.destinationUrl);
    if (!dest) continue;
    const key = mapping.keyword.toLowerCase();
    if (!keywordToDestinations.has(key)) {
      keywordToDestinations.set(key, new Set());
    }
    keywordToDestinations.get(key)!.add(dest);

    if (mapping.group) {
      const groupKey = mapping.group.toLowerCase();
      if (!groupToDestinations.has(groupKey)) {
        groupToDestinations.set(groupKey, new Set());
      }
      groupToDestinations.get(groupKey)!.add(dest);
    }
  }

  for (const mapping of keywordMappings) {
    const destination = normaliseUrl(mapping.destinationUrl);
    if (!destination) continue;

    const lowerKeyword = mapping.keyword.toLowerCase();
    const keywordHasMultipleDests =
      (keywordToDestinations.get(lowerKeyword)?.size ?? 0) > 1;

    const groupKey = mapping.group?.toLowerCase();
    const groupHasMultipleDests =
      groupKey && (groupToDestinations.get(groupKey)?.size ?? 0) > 1;

    for (const page of pages) {
      const sourceUrl = page.canonicalUrl || page.finalUrl || page.url;

      if (urlsEqual(sourceUrl, destination)) {
        results.push({
          keyword: mapping.keyword,
          group: mapping.group,
          sourceUrl,
          sourceTitle: page.title || page.metaTitle || page.h1,
          destinationUrl: destination,
          snippet: null,
          status: "Source equals destination",
          score: 1,
          cannibalisationRisk: Boolean(keywordHasMultipleDests || groupHasMultipleDests)
        });
        continue;
      }

      const searchText = page.bodyTextWithoutAnchors || page.bodyText;
      const positions = findKeywordPositions(
        searchText,
        mapping.keyword,
        mapping.matchMode
      );

      if (positions.length === 0) {
        results.push({
          keyword: mapping.keyword,
          group: mapping.group,
          sourceUrl,
          sourceTitle: page.title || page.metaTitle || page.h1,
          destinationUrl: destination,
          snippet: null,
          status: "Keyword not found",
          score: 1,
          cannibalisationRisk: Boolean(keywordHasMultipleDests || groupHasMultipleDests)
        });
        continue;
      }

      const linkFlags = anchorsWithKeyword(
        page,
        mapping.keyword,
        destination
      );

      if (pageLinksToDestination(page, destination) && linkFlags.toDestination) {
        results.push({
          keyword: mapping.keyword,
          group: mapping.group,
          sourceUrl,
          sourceTitle: page.title || page.metaTitle || page.h1,
          destinationUrl: destination,
          snippet: null,
          status: "Already linked",
          score: computeScore({
            matchCount: positions.length,
            path: new URL(sourceUrl).pathname,
            hasExistingLinks: true,
            status: "Already linked"
          }),
          cannibalisationRisk: Boolean(keywordHasMultipleDests || groupHasMultipleDests)
        });
        continue;
      }

      if (linkFlags.toOther) {
        const status: OpportunityStatus = "Linked to different URL";
        results.push({
          keyword: mapping.keyword,
          group: mapping.group,
          sourceUrl,
          sourceTitle: page.title || page.metaTitle || page.h1,
          destinationUrl: destination,
          snippet: buildSnippet(searchText, positions[0]),
          status,
          score: computeScore({
            matchCount: positions.length,
            path: new URL(sourceUrl).pathname,
            hasExistingLinks: page.outgoingInternalLinks.length > 0,
            status
          }),
          cannibalisationRisk: true
        });
        continue;
      }

      const snippet = buildSnippet(searchText, positions[0]);

      const status: OpportunityStatus = "Opportunity found";
      results.push({
        keyword: mapping.keyword,
        group: mapping.group,
        sourceUrl,
        sourceTitle: page.title || page.metaTitle || page.h1,
        destinationUrl: destination,
        snippet,
        status,
        score: computeScore({
          matchCount: positions.length,
          path: new URL(sourceUrl).pathname,
          hasExistingLinks: page.outgoingInternalLinks.length > 0,
          status
        }),
        cannibalisationRisk: Boolean(keywordHasMultipleDests || groupHasMultipleDests)
      });
    }
  }

  return results;
}


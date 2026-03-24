import type {
  AnalyseGraphPayload,
  OpportunityResult,
  OpportunityStatus,
  PageData,
  TopicalMapEdge,
  TopicalMapEdgeKind,
  TopicalMapNode
} from "@/types";
import { normaliseUrl } from "@/lib/url";

function pathLabel(url: string): string {
  try {
    const p = new URL(url).pathname;
    return p || "/";
  } catch {
    return url;
  }
}

function displayLabelForPage(p: PageData): string {
  const h1 = p.h1?.trim();
  if (h1) return h1.length > 80 ? `${h1.slice(0, 77)}…` : h1;
  const title = p.title?.trim() || p.metaTitle?.trim();
  if (title) return title.length > 80 ? `${title.slice(0, 77)}…` : title;
  return pathLabel(p.finalUrl || p.url);
}

export function statusToTopicalKind(
  s: OpportunityStatus
): TopicalMapEdgeKind {
  switch (s) {
    case "Opportunity found":
      return "suggestion_opportunity";
    case "Weak anchor":
      return "suggestion_weak";
    case "Strong link":
      return "suggestion_strong";
    case "Linked to different URL":
      return "suggestion_linked_elsewhere";
    case "Source equals destination":
    case "Keyword not found":
    default:
      return "suggestion_other";
  }
}

function sugKey(
  source: string,
  target: string,
  kind: TopicalMapEdgeKind
): string {
  return JSON.stringify([source, target, kind]);
}

/**
 * Build nodes + edges for the topical map: observed internal links + suggestion
 * rows (aggregated by source, target, and kind).
 */
export function buildAnalyseGraphPayload(
  pages: PageData[],
  results: OpportunityResult[]
): AnalyseGraphPayload {
  const nodes = new Map<string, TopicalMapNode>();
  const observedKeys = new Set<string>();

  const ensureNode = (rawUrl: string, page?: PageData): string | null => {
    const id = normaliseUrl(rawUrl);
    if (!id) return null;
    if (!nodes.has(id)) {
      if (page) {
        nodes.set(id, {
          id,
          url: id,
          title: page.title,
          h1: page.h1,
          displayLabel: displayLabelForPage(page),
          crawled: true
        });
      } else {
        nodes.set(id, {
          id,
          url: id,
          title: null,
          h1: null,
          displayLabel: pathLabel(id),
          crawled: false
        });
      }
    }
    return id;
  };

  for (const p of pages) {
    const sid = ensureNode(p.finalUrl || p.url, p);
    if (!sid) continue;

    for (const href of p.outgoingInternalLinks ?? []) {
      const tid = ensureNode(href);
      if (!tid || sid === tid) continue;
      observedKeys.add(JSON.stringify([sid, tid]));
    }
  }

  const suggestionAgg = new Map<
    string,
    { kind: TopicalMapEdgeKind; keywords: Set<string>; statuses: Set<OpportunityStatus> }
  >();

  for (const r of results) {
    const sid = ensureNode(r.sourceUrl);
    const tid = ensureNode(r.destinationUrl);
    if (!sid || !tid || sid === tid) continue;

    const kind = statusToTopicalKind(r.status);
    const key = sugKey(sid, tid, kind);
    let agg = suggestionAgg.get(key);
    if (!agg) {
      agg = {
        kind,
        keywords: new Set<string>(),
        statuses: new Set<OpportunityStatus>()
      };
      suggestionAgg.set(key, agg);
    }
    agg.keywords.add(r.keyword.trim());
    agg.statuses.add(r.status);
  }

  const edges: TopicalMapEdge[] = [];

  for (const raw of observedKeys) {
    const [s, t] = JSON.parse(raw) as [string, string];
    edges.push({
      id: `obs-${raw}`,
      source: s,
      target: t,
      kind: "observed",
      keywords: [],
      statuses: []
    });
  }

  for (const [key, agg] of suggestionAgg) {
    const [s, t, kind] = JSON.parse(key) as [string, string, TopicalMapEdgeKind];
    edges.push({
      id: `sug-${key}`,
      source: s,
      target: t,
      kind,
      keywords: [...agg.keywords].sort((a, b) => a.localeCompare(b)),
      statuses: [...agg.statuses]
    });
  }

  return {
    nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges
  };
}

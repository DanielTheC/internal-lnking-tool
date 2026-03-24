import type { TopicalMapEdgeKind } from "@/types";

/** Hex colours for 2D canvas + legend (distinct, colour-blind friendly as far as practical). */
export const TOPICAL_EDGE_COLORS: Record<TopicalMapEdgeKind, string> = {
  observed: "#94a3b8",
  suggestion_opportunity: "#34d399",
  suggestion_weak: "#fbbf24",
  suggestion_strong: "#22d3ee",
  suggestion_linked_elsewhere: "#fb7185",
  suggestion_other: "#a78bfa"
};

export const TOPICAL_EDGE_LABELS: Record<TopicalMapEdgeKind, string> = {
  observed: "Existing link (crawled)",
  suggestion_opportunity: "Suggested · opportunity",
  suggestion_weak: "Suggested · weak anchor",
  suggestion_strong: "Suggested · strong link",
  suggestion_linked_elsewhere: "Suggested · links elsewhere",
  suggestion_other: "Suggested · other status"
};

export const ALL_TOPICAL_KINDS: TopicalMapEdgeKind[] = [
  "observed",
  "suggestion_opportunity",
  "suggestion_weak",
  "suggestion_strong",
  "suggestion_linked_elsewhere",
  "suggestion_other"
];

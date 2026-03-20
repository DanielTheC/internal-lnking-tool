import type {
  GscKeywordMetrics,
  OpportunityResult
} from "@/types";

/**
 * Extra score points from GSC demand (capped). Higher impressions/clicks and
 * better (lower) average position add weight.
 */
export function gscScoreBonus(m: GscKeywordMetrics): number {
  const imp = m.impressions;
  const clk = m.clicks;
  const pos = m.position ?? 50;

  let b = 0;
  b += Math.min(Math.log10(imp + 1) * 1.2, 4);
  b += Math.min(Math.log10(clk + 1) * 1.5, 3);
  b += Math.max(0, (28 - Math.min(pos, 28)) / 14);
  return Math.round(Math.min(b, 8));
}

export function applyGscToResults(
  results: OpportunityResult[],
  gscByKeyword: Record<string, GscKeywordMetrics> | undefined
): OpportunityResult[] {
  if (!gscByKeyword || Object.keys(gscByKeyword).length === 0) {
    return results;
  }

  return results.map((r) => {
    const key = r.keyword.trim().toLowerCase();
    const gsc = gscByKeyword[key];
    if (!gsc) return r;

    const bonus = gscScoreBonus(gsc);
    return {
      ...r,
      score: r.score + bonus,
      gscImpressions: gsc.impressions,
      gscClicks: gsc.clicks,
      gscPosition: gsc.position
    };
  });
}

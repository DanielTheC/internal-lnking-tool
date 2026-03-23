import type { GscKeywordMetrics } from "@/types";

export function sanitizeGscByKeyword(
  raw: Record<string, GscKeywordMetrics> | undefined
): Record<string, GscKeywordMetrics> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const entries = Object.entries(raw).slice(0, 8000);
  const gscByKeyword: Record<string, GscKeywordMetrics> = {};
  for (const [k, v] of entries) {
    if (!v || typeof v !== "object") continue;
    const im = Number(v.impressions);
    const cl = Number(v.clicks);
    if (!Number.isFinite(im) || !Number.isFinite(cl)) continue;
    const posRaw = v.position;
    const pos =
      posRaw !== undefined && Number.isFinite(Number(posRaw))
        ? Number(posRaw)
        : undefined;
    gscByKeyword[k.trim().toLowerCase()] = {
      impressions: Math.max(0, im),
      clicks: Math.max(0, cl),
      position: pos
    };
  }
  return Object.keys(gscByKeyword).length ? gscByKeyword : undefined;
}

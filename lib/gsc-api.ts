import { google } from "googleapis";
import type { GscKeywordMetrics } from "@/types";
import { createGscOAuth2Client } from "@/lib/gsc-oauth";

export type GscSiteEntry = { siteUrl: string; permissionLevel?: string | null };

export async function listGscSites(refreshToken: string): Promise<GscSiteEntry[]> {
  const oauth2 = createGscOAuth2Client();
  oauth2.setCredentials({ refresh_token: refreshToken });
  const webmasters = google.webmasters({ version: "v3", auth: oauth2 });
  const res = await webmasters.sites.list();
  const entries = res.data.siteEntry ?? [];
  return entries
    .map((e) => ({
      siteUrl: e.siteUrl ?? "",
      permissionLevel: e.permissionLevel
    }))
    .filter((x) => x.siteUrl.length > 0);
}

/**
 * Fetch Performance → Queries (dimension query) and merge into the same shape as CSV import.
 */
export async function fetchGscQueryMetrics(params: {
  refreshToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
}): Promise<Record<string, GscKeywordMetrics>> {
  const oauth2 = createGscOAuth2Client();
  oauth2.setCredentials({ refresh_token: params.refreshToken });
  const webmasters = google.webmasters({ version: "v3", auth: oauth2 });

  const rows: Array<{
    keys?: string[] | null;
    clicks?: number | null;
    impressions?: number | null;
    position?: number | null;
  }> = [];
  let startRow = 0;
  const rowLimit = 25000;
  for (;;) {
    const res = await webmasters.searchanalytics.query({
      siteUrl: params.siteUrl,
      requestBody: {
        startDate: params.startDate,
        endDate: params.endDate,
        dimensions: ["query"],
        rowLimit,
        startRow
      }
    });
    const batch = res.data.rows ?? [];
    if (batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < rowLimit) break;
    startRow += rowLimit;
  }

  const agg = new Map<
    string,
    { clicks: number; impressions: number; posWeight: number }
  >();

  for (const row of rows) {
    const q = (row.keys?.[0] ?? "").trim();
    if (!q) continue;
    const key = q.toLowerCase();
    const clicks = row.clicks ?? 0;
    const impressions = row.impressions ?? 0;
    const position = row.position ?? 0;
    const cur = agg.get(key) ?? { clicks: 0, impressions: 0, posWeight: 0 };
    cur.clicks += clicks;
    cur.impressions += impressions;
    if (position > 0 && impressions > 0) {
      cur.posWeight += position * impressions;
    }
    agg.set(key, cur);
  }

  const out: Record<string, GscKeywordMetrics> = {};
  for (const [key, v] of agg) {
    const position =
      v.impressions > 0 && v.posWeight > 0
        ? Math.round((v.posWeight / v.impressions) * 100) / 100
        : undefined;
    out[key] = {
      clicks: v.clicks,
      impressions: v.impressions,
      position
    };
  }
  return out;
}

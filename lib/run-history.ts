import type { AnalyseResponseBody, OpportunityResult } from "@/types";

export const RUN_HISTORY_STORAGE_KEY = "ilo-run-history";
export const MAX_SAVED_RUNS = 40;
/** Rough guard so localStorage stays usable (UTF-16 ≈ 2 bytes per char). */
export const MAX_HISTORY_JSON_CHARS = 4_500_000;

export type SavedRunRecord = {
  id: string;
  createdAt: number;
  /** Normalised origin e.g. https://example.com */
  domain: string;
  label?: string;
  crawledPageCount: number;
  totalKeywordMappingsAnalysed: number;
  totalOpportunitiesFound: number;
  settings: {
    maxPages?: number;
    sitemapOnly?: boolean;
    incremental?: boolean;
    sitemapUrl?: string;
  };
  result: AnalyseResponseBody;
};

export type RunComparisonSummary = {
  baselineId: string;
  currentId: string;
  domain: string;
  newCount: number;
  removedCount: number;
  statusChangeCount: number;
  newRows: OpportunityResult[];
  removedRows: OpportunityResult[];
  statusChanges: {
    key: string;
    keyword: string;
    sourceUrl: string;
    destinationUrl: string;
    beforeStatus: OpportunityResult["status"];
    afterStatus: OpportunityResult["status"];
    beforeScore: number;
    afterScore: number;
  }[];
};

/** Diff vs the most recent saved run for the same domain (before appending the new run). */
export type SinceLastCrawlState = {
  previousRunAt: number;
  domain: string;
} & Omit<RunComparisonSummary, "baselineId" | "currentId" | "domain">;

export function normalizeDomainForHistory(domain: string): string {
  const t = domain.trim();
  if (!t) return "";
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    return u.origin;
  } catch {
    return t.toLowerCase();
  }
}

/** Stable row identity for mapping × page × destination. */
export function opportunityKey(r: OpportunityResult): string {
  const k = r.keyword.trim().toLowerCase();
  const s = r.sourceUrl.trim();
  const d = r.destinationUrl.trim();
  return `${k}|${s}|${d}`;
}

function mapByKey(rows: OpportunityResult[]): Map<string, OpportunityResult> {
  const m = new Map<string, OpportunityResult>();
  for (const r of rows) {
    m.set(opportunityKey(r), r);
  }
  return m;
}

export function compareRuns(
  baseline: AnalyseResponseBody,
  current: AnalyseResponseBody
): Omit<
  RunComparisonSummary,
  "baselineId" | "currentId" | "domain"
> {
  const a = mapByKey(baseline.results);
  const b = mapByKey(current.results);

  const newRows: OpportunityResult[] = [];
  const removedRows: OpportunityResult[] = [];
  const statusChanges: RunComparisonSummary["statusChanges"] = [];

  for (const [key, row] of b) {
    if (!a.has(key)) {
      newRows.push(row);
      continue;
    }
    const prev = a.get(key)!;
    if (prev.status !== row.status) {
      statusChanges.push({
        key,
        keyword: row.keyword,
        sourceUrl: row.sourceUrl,
        destinationUrl: row.destinationUrl,
        beforeStatus: prev.status,
        afterStatus: row.status,
        beforeScore: prev.score,
        afterScore: row.score
      });
    }
  }

  for (const [key, row] of a) {
    if (!b.has(key)) {
      removedRows.push(row);
    }
  }

  return {
    newCount: newRows.length,
    removedCount: removedRows.length,
    statusChangeCount: statusChanges.length,
    newRows,
    removedRows,
    statusChanges
  };
}

export function loadRunHistory(): SavedRunRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RUN_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is SavedRunRecord =>
        x != null &&
        typeof x === "object" &&
        typeof (x as SavedRunRecord).id === "string" &&
        typeof (x as SavedRunRecord).createdAt === "number" &&
        typeof (x as SavedRunRecord).result === "object"
    );
  } catch {
    return [];
  }
}

export function saveRunHistory(runs: SavedRunRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    let json = JSON.stringify(runs);
    while (json.length > MAX_HISTORY_JSON_CHARS && runs.length > 1) {
      runs = runs.slice(0, -1);
      json = JSON.stringify(runs);
    }
    window.localStorage.setItem(RUN_HISTORY_STORAGE_KEY, json);
  } catch (e) {
    console.warn("saveRunHistory failed", e);
  }
}

export function appendRun(record: Omit<SavedRunRecord, "id">): SavedRunRecord {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const full: SavedRunRecord = { ...record, id };
  const prev = loadRunHistory();
  const next = [full, ...prev].slice(0, MAX_SAVED_RUNS);
  saveRunHistory(next);
  return full;
}

export function deleteRun(id: string): void {
  const prev = loadRunHistory();
  saveRunHistory(prev.filter((r) => r.id !== id));
}

export function findPreviousRunForDomain(
  domain: string,
  excludeId?: string
): SavedRunRecord | null {
  const norm = normalizeDomainForHistory(domain);
  const runs = loadRunHistory();
  for (const r of runs) {
    if (excludeId && r.id === excludeId) continue;
    if (normalizeDomainForHistory(r.domain) === norm) {
      return r;
    }
  }
  return null;
}

export function downloadJson(filename: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildExportFilenameBase(domain: string): string {
  try {
    const host = new URL(domain.startsWith("http") ? domain : `https://${domain}`)
      .hostname;
    return `ilo-${host.replace(/[^a-z0-9.-]+/gi, "_")}`;
  } catch {
    return "ilo-export";
  }
}

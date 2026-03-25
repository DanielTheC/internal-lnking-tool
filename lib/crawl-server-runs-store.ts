import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { AnalyseResponseBody } from "@/types";
import { getRedis, isRedisConfigured } from "@/lib/crawl-queue-redis";
import { isCrawlServerSaveEnabled } from "@/lib/crawl-server-save-env";
import {
  MAX_HISTORY_JSON_CHARS,
  MAX_SAVED_RUNS,
  normalizeDomainForHistory,
  type SavedRunRecord
} from "@/lib/run-history";

const REDIS_KEY = "ilo:crawl-server-runs:blob:v1";
const FILE = path.join(process.cwd(), ".data", "crawl-server-runs.json");

type BlobShape = { runs: SavedRunRecord[] };

async function readBlob(): Promise<string | null> {
  if (isRedisConfigured()) {
    const r = getRedis();
    if (!r) return null;
    return r.get(REDIS_KEY);
  }
  try {
    return await fs.readFile(FILE, "utf8");
  } catch {
    return null;
  }
}

async function writeBlob(s: string): Promise<void> {
  if (isRedisConfigured()) {
    const r = getRedis();
    if (!r) throw new Error("REDIS_URL is set but Redis client is unavailable");
    await r.set(REDIS_KEY, s);
    return;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, s, "utf8");
}

async function loadRuns(): Promise<SavedRunRecord[]> {
  const raw = await readBlob();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as BlobShape).runs)
    ) {
      return (parsed as BlobShape).runs.filter(
        (r): r is SavedRunRecord =>
          r != null &&
          typeof r === "object" &&
          typeof r.id === "string" &&
          typeof r.result === "object"
      );
    }
  } catch {
    // ignore
  }
  return [];
}

async function saveRuns(runs: SavedRunRecord[]): Promise<void> {
  let json = JSON.stringify({ runs } satisfies BlobShape);
  while (json.length > MAX_HISTORY_JSON_CHARS && runs.length > 1) {
    runs = runs.slice(0, -1);
    json = JSON.stringify({ runs } satisfies BlobShape);
  }
  await writeBlob(json);
}

export type ServerRunListItem = Omit<SavedRunRecord, "result">;

export async function appendServerRunFromResult(args: {
  domain: string;
  label?: string;
  settings: SavedRunRecord["settings"];
  result: AnalyseResponseBody;
}): Promise<SavedRunRecord | null> {
  if (!isCrawlServerSaveEnabled()) {
    return null;
  }
  const domain = normalizeDomainForHistory(args.domain);
  if (!domain) return null;

  const record: SavedRunRecord = {
    id: randomUUID(),
    createdAt: Date.now(),
    domain,
    label: args.label?.trim() || undefined,
    crawledPageCount: args.result.crawledPageCount,
    totalKeywordMappingsAnalysed: args.result.totalKeywordMappingsAnalysed,
    totalOpportunitiesFound: args.result.totalOpportunitiesFound,
    settings: args.settings,
    result: args.result
  };

  const list = await loadRuns();
  const next = [record, ...list].slice(0, MAX_SAVED_RUNS);
  await saveRuns(next);
  return record;
}

export async function listServerRunsMeta(): Promise<ServerRunListItem[]> {
  const runs = await loadRuns();
  return runs.map(({ result: _r, ...meta }) => meta);
}

export async function getServerRun(id: string): Promise<SavedRunRecord | null> {
  const runs = await loadRuns();
  return runs.find((r) => r.id === id) ?? null;
}

export async function deleteServerRun(id: string): Promise<boolean> {
  const runs = await loadRuns();
  const next = runs.filter((r) => r.id !== id);
  if (next.length === runs.length) return false;
  await saveRuns(next);
  return true;
}

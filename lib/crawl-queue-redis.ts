import { randomUUID } from "crypto";
import Redis from "ioredis";
import type { AnalyseRequestBody, AnalyseResponseBody } from "@/types";
export const CRAWL_QUEUE_KEY = "ilo:crawl:queue";
const JOB_PREFIX = "ilo:crawl:job:";
const JOB_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

export type CrawlJobStatus = "queued" | "running" | "complete" | "failed";

let client: Redis | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

export function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (!client) {
    client = new Redis(process.env.REDIS_URL as string, {
      maxRetriesPerRequest: null
    });
  }
  return client;
}

export function crawlJobRedisKey(id: string): string {
  return `${JOB_PREFIX}${id}`;
}

function jobKey(id: string): string {
  return crawlJobRedisKey(id);
}

export async function enqueueCrawlJob(
  payload: AnalyseRequestBody
): Promise<string> {
  const r = getRedis();
  if (!r) throw new Error("REDIS_URL is not configured");

  const id = crypto.randomUUID();
  const now = Date.now();
  await r
    .multi()
    .hset(jobKey(id), {
      status: "queued",
      payload: JSON.stringify(payload),
      progress: "Queued",
      pagesCollected: "0",
      createdAt: String(now),
      updatedAt: String(now)
    })
    .expire(jobKey(id), JOB_TTL_SEC)
    .rpush(CRAWL_QUEUE_KEY, id)
    .exec();

  return id;
}

export async function updateCrawlJob(
  id: string,
  patch: Partial<{
    status: CrawlJobStatus;
    progress: string;
    pagesCollected: number;
    maxPages: number;
    result: AnalyseResponseBody;
    error: string;
  }>
): Promise<void> {
  const r = getRedis();
  if (!r) return;

  const flat: Record<string, string> = {
    updatedAt: String(Date.now())
  };
  if (patch.status != null) flat.status = patch.status;
  if (patch.progress != null) flat.progress = patch.progress;
  if (patch.pagesCollected != null) {
    flat.pagesCollected = String(patch.pagesCollected);
  }
  if (patch.maxPages != null) flat.maxPages = String(patch.maxPages);
  if (patch.result != null) flat.result = JSON.stringify(patch.result);
  if (patch.error != null) flat.error = patch.error;

  await r.hset(jobKey(id), flat);
  await r.expire(jobKey(id), JOB_TTL_SEC);
}

export type CrawlJobRecord = {
  id: string;
  status: CrawlJobStatus;
  progress: string;
  pagesCollected?: number;
  maxPages?: number;
  result?: AnalyseResponseBody;
  error?: string;
  createdAt?: number;
  updatedAt?: number;
};

export async function getCrawlJob(id: string): Promise<CrawlJobRecord | null> {
  const r = getRedis();
  if (!r) return null;

  const raw = await r.hgetall(jobKey(id));
  if (!raw || Object.keys(raw).length === 0) return null;

  const status = raw.status as CrawlJobStatus;
  let result: AnalyseResponseBody | undefined;
  if (raw.result) {
    try {
      result = JSON.parse(raw.result) as AnalyseResponseBody;
    } catch {
      // ignore
    }
  }

  return {
    id,
    status: status || "queued",
    progress: raw.progress || "",
    pagesCollected:
      raw.pagesCollected != null ? Number(raw.pagesCollected) : undefined,
    maxPages: raw.maxPages != null ? Number(raw.maxPages) : undefined,
    result,
    error: raw.error,
    createdAt: raw.createdAt ? Number(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? Number(raw.updatedAt) : undefined
  };
}

/** Worker: blocking pop next job id (right push, left pop = FIFO with BLPOP). */
export async function blockingPopJobId(timeoutSec: number): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;

  const out = await r.blpop(CRAWL_QUEUE_KEY, timeoutSec);
  if (!out) return null;
  return out[1];
}

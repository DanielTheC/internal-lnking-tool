/**
 * Long-running crawl worker (Redis queue). Run beside the Next.js app:
 *   REDIS_URL=redis://127.0.0.1:6379 npm run crawl-worker
 *
 * Not for Vercel serverless — use a VM, Docker, or Railway/Render worker process.
 */

import { runFullAnalyse } from "@/lib/run-full-analyse";
import { appendServerRunFromResult } from "@/lib/crawl-server-runs-store";
import {
  blockingPopJobId,
  crawlJobRedisKey,
  getRedis,
  updateCrawlJob
} from "@/lib/crawl-queue-redis";
import type { AnalyseRequestBody } from "@/types";

async function processJob(jobId: string): Promise<void> {
  const r = getRedis();
  if (!r) return;

  const raw = await r.hgetall(crawlJobRedisKey(jobId));
  const payloadJson = raw.payload;
  if (!payloadJson) {
    await updateCrawlJob(jobId, {
      status: "failed",
      error: "Missing job payload"
    });
    return;
  }

  if (raw.status !== "queued") {
    console.warn("Skip job (not queued)", jobId, raw.status);
    return;
  }

  let payload: AnalyseRequestBody;
  try {
    payload = JSON.parse(payloadJson) as AnalyseRequestBody;
  } catch {
    await updateCrawlJob(jobId, {
      status: "failed",
      error: "Invalid job payload JSON"
    });
    return;
  }

  await updateCrawlJob(jobId, {
    status: "running",
    progress: "Starting crawl…",
    pagesCollected: 0,
    maxPages: Math.min(Math.max(payload.maxPages ?? 50, 1), 500)
  });

  try {
    const result = await runFullAnalyse({
      ...payload,
      onProgress: async (info) => {
        await updateCrawlJob(jobId, {
          status: "running",
          progress: `Crawling… ${info.pagesCollected} / ${info.maxPages} pages (batch ${info.batchIndex})`,
          pagesCollected: info.pagesCollected,
          maxPages: info.maxPages
        });
      }
    });
    await updateCrawlJob(jobId, {
      status: "complete",
      progress: "Complete",
      result
    });
    void appendServerRunFromResult({
      domain: payload.domain,
      settings: {
        maxPages: payload.maxPages,
        sitemapOnly: payload.sitemapOnly,
        incremental: payload.incremental,
        sitemapUrl: payload.sitemapUrl
      },
      result
    }).catch(() => {
      /* non-fatal */
    });
    console.info("Job complete", jobId, result.crawledPageCount, "pages");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Job failed", jobId, msg);
    await updateCrawlJob(jobId, {
      status: "failed",
      error: msg,
      progress: "Failed"
    });
  }
}

async function main(): Promise<void> {
  if (!process.env.REDIS_URL?.trim()) {
    console.error("Set REDIS_URL (e.g. redis://127.0.0.1:6379)");
    process.exit(1);
  }

  console.info("Crawl worker listening on Redis queue (ilo:crawl:queue)…");

  for (;;) {
    const jobId = await blockingPopJobId(0);
    if (!jobId) continue;
    await processJob(jobId);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

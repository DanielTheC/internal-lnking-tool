import { NextRequest, NextResponse } from "next/server";
import type { CrawlBatchRequestBody, CrawlBatchResponseBody } from "@/types";
import { runCrawlBatch } from "@/lib/crawler";
import { parseSitemapUrls } from "@/lib/sitemap";
import { normaliseUrl } from "@/lib/url";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CrawlBatchRequestBody;
    const {
      domain,
      sitemapUrl,
      maxPages = 100,
      userAgent,
      sitemapOnly,
      alreadyCollected = 0,
      batchPageLimit: rawBatch,
      state
    } = body;

    if (!domain) {
      return NextResponse.json({ error: "Domain is required." }, { status: 400 });
    }

    const normalisedDomain = normaliseUrl(domain);
    if (!normalisedDomain) {
      return NextResponse.json({ error: "Invalid domain." }, { status: 400 });
    }

    const limitedMaxPages = Math.min(Math.max(maxPages || 1, 1), 500);
    const batchPageLimit = Math.min(
      Math.max(rawBatch ?? 15, 5),
      40
    );

    const onVercel = process.env.VERCEL === "1";

    let initialQueue: string[] = [];
    if (!state) {
      if (sitemapUrl) {
        initialQueue = await parseSitemapUrls(sitemapUrl, normalisedDomain);
      }
      if (initialQueue.length === 0) {
        initialQueue = [normalisedDomain];
      }
    }

    const result = await runCrawlBatch({
      domainBaseUrl: normalisedDomain,
      userAgent,
      followLinks: sitemapOnly ? false : true,
      delayMs: onVercel ? 0 : 250,
      requestTimeoutMs: onVercel ? 10000 : 15000,
      startUrls: state ? [] : initialQueue,
      maxPagesTotal: limitedMaxPages,
      alreadyCollected,
      maxNewPagesThisCall: batchPageLimit,
      state
    });

    const response: CrawlBatchResponseBody = {
      newPages: result.newPages,
      state: result.state,
      complete: result.complete
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error("Crawl batch error", e);
    const detail = e instanceof Error ? e.message : String(e);
    const safe = detail.replace(/\s+/g, " ").trim().slice(0, 400);
    return NextResponse.json(
      {
        error:
          safe && safe.length > 0
            ? `Crawl batch failed: ${safe}`
            : "Crawl batch failed."
      },
      { status: 500 }
    );
  }
}

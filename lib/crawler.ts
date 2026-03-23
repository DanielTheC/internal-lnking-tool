import axios from "axios";
import type { CrawlOptions, PageData, SerializableCrawlState } from "@/types";
import { extractPageData } from "./extractor";
import { isHtmlLikeUrl, isInternalUrl, normaliseUrl, shouldIgnoreHref } from "./url";
import * as cheerio from "cheerio";

export type CrawlBatchParams = {
  domainBaseUrl: string;
  userAgent?: string;
  followLinks: boolean;
  delayMs: number;
  requestTimeoutMs: number;
  /** Seed URLs when `state` is null (e.g. homepage or sitemap URLs). */
  startUrls: string[];
  maxPagesTotal: number;
  alreadyCollected: number;
  maxNewPagesThisCall: number;
  state: SerializableCrawlState | null;
};

export type CrawlBatchResult = {
  newPages: PageData[];
  state: SerializableCrawlState;
  complete: boolean;
};

/**
 * Fetch up to `maxNewPagesThisCall` new indexable pages, then return serialisable
 * frontier state for the next invocation (chunked crawls for serverless).
 */
export async function runCrawlBatch(
  params: CrawlBatchParams
): Promise<CrawlBatchResult> {
  const startDomain = normaliseUrl(params.domainBaseUrl);
  if (!startDomain) {
    throw new Error("Invalid domain");
  }

  const visited = new Set<string>(params.state?.visited ?? []);
  const queue = [...(params.state?.queue ?? [])];

  if (!params.state) {
    if (params.startUrls.length > 0) {
      for (const u of params.startUrls) {
        const n = normaliseUrl(u, startDomain);
        if (n) queue.push(n);
      }
    } else {
      queue.push(startDomain);
    }
  }

  const newPages: PageData[] = [];

  while (queue.length > 0) {
    if (params.alreadyCollected + newPages.length >= params.maxPagesTotal) {
      break;
    }
    if (newPages.length >= params.maxNewPagesThisCall) {
      break;
    }

    const current = queue.shift()!;
    const normalised = normaliseUrl(current);
    if (!normalised) continue;
    if (visited.has(normalised)) continue;
    visited.add(normalised);

    try {
      if (params.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, params.delayMs));
      }

      const res = await axios.get<string>(normalised, {
        maxRedirects: 5,
        timeout: params.requestTimeoutMs,
        validateStatus: (s) => s >= 200 && s < 500,
        headers: {
          "User-Agent":
            params.userAgent ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        }
      });

      const contentType = res.headers["content-type"] || "";
      if (!contentType.includes("text/html")) {
        console.warn("Skipping non-HTML content", {
          url: normalised,
          status: res.status,
          contentType
        });
        continue;
      }

      const html = res.data;
      const pageData = extractPageData(normalised, html, startDomain);

      if (pageData.robots.noindex) {
        console.info("Skipping noindex page", { url: normalised });
        continue;
      }

      if (params.alreadyCollected + newPages.length < params.maxPagesTotal) {
        newPages.push(pageData);
      }

      const $ = cheerio.load(html);
      if (params.followLinks) {
        $("a[href]").each((_, el) => {
          const href = $(el).attr("href");
          if (!href || shouldIgnoreHref(href)) return;
          const absolute = normaliseUrl(href, normalised);
          if (!absolute) return;
          if (!isInternalUrl(absolute, startDomain)) return;
          if (!isHtmlLikeUrl(absolute)) return;
          if (!visited.has(absolute)) {
            queue.push(absolute);
          }
        });
      }
    } catch (error) {
      console.error("Crawl error", { url: normalised, error });
      continue;
    }
  }

  const atCap =
    params.alreadyCollected + newPages.length >= params.maxPagesTotal;
  const complete = queue.length === 0 || atCap;

  return {
    newPages,
    state: {
      queue,
      visited: Array.from(visited)
    },
    complete
  };
}

/** Single long-running crawl (local / long serverless). Uses internal batching with one large batch size. */
export async function crawlSite(options: CrawlOptions): Promise<PageData[]> {
  const {
    domain,
    maxPages = 100,
    startUrls,
    userAgent,
    followLinks = true,
    delayMs = 250,
    requestTimeoutMs = 15000
  } = options;
  const startDomain = normaliseUrl(domain);
  if (!startDomain) {
    throw new Error("Invalid domain");
  }

  const seeds =
    startUrls && startUrls.length > 0 ? startUrls : [startDomain];

  const all: PageData[] = [];
  let state: SerializableCrawlState | null = null;
  let complete = false;

  while (!complete && all.length < maxPages) {
    const batch = await runCrawlBatch({
      domainBaseUrl: startDomain,
      userAgent,
      followLinks,
      delayMs,
      requestTimeoutMs,
      startUrls: state ? [] : seeds,
      maxPagesTotal: maxPages,
      alreadyCollected: all.length,
      maxNewPagesThisCall: maxPages - all.length,
      state
    });
    all.push(...batch.newPages);
    state = batch.state;
    complete = batch.complete;
  }

  return all;
}


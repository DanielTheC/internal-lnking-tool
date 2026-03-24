import axios from "axios";
import type {
  CrawlOptions,
  PageData,
  SerializableCrawlState,
  SerializableUrlCacheEntry
} from "@/types";
import { CrawlFatalError, isLikelyBotChallengePage } from "./crawl-http-guards";
import { extractPageData } from "./extractor";
import {
  getLinkResolutionBase,
  isHtmlLikeUrl,
  isInternalUrl,
  normaliseUrl,
  shouldIgnoreHref,
  shouldSkipCrawlUrl
} from "./url";
import * as cheerio from "cheerio";
import { isUrlPathUnderPrefixes } from "@/lib/path-prefixes";
import {
  fetchRobotsMatcher,
  getEffectiveCrawlDelayMs,
  isUrlAllowedByRobots,
  matcherFromCachedRaw,
  type RobotsMatcher
} from "@/lib/robots-policy";
import {
  loadUrlCache,
  saveUrlCache,
  isIncrementalPersistenceAvailable
} from "@/lib/crawl-incremental-cache";

const DEFAULT_CRAWL_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

function defaultBrowserHeaders(userAgent: string | undefined): Record<string, string> {
  const ua = userAgent || DEFAULT_CRAWL_USER_AGENT;
  return {
    "User-Agent": ua,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br"
  };
}

function buildBrowserHeaders(
  userAgent: string | undefined,
  conditional?: SerializableUrlCacheEntry | undefined
): Record<string, string> {
  const h = defaultBrowserHeaders(userAgent);
  if (conditional?.etag) h["If-None-Match"] = conditional.etag;
  if (conditional?.lastModified) h["If-Modified-Since"] = conditional.lastModified;
  return h;
}

function recordCacheEntry(
  pageData: PageData,
  headers: Record<string, unknown>
): SerializableUrlCacheEntry {
  const etag = (headers["etag"] as string | undefined) ?? null;
  const lastModified = (headers["last-modified"] as string | undefined) ?? null;
  return {
    etag,
    lastModified,
    pageData,
    savedAt: Date.now()
  };
}

function enqueueLinksFromPageData(
  pageData: PageData,
  ctx: {
    startDomain: string;
    followLinks: boolean;
    pathPrefixes: string[];
    robotsMatcher: RobotsMatcher | null;
    crawlUserAgent: string;
    visited: Set<string>;
    queue: string[];
  }
): void {
  if (!ctx.followLinks) return;
  for (const absolute of pageData.outgoingInternalLinks ?? []) {
    if (!absolute) continue;
    if (shouldSkipCrawlUrl(absolute)) continue;
    if (
      ctx.pathPrefixes.length > 0 &&
      !isUrlPathUnderPrefixes(absolute, ctx.pathPrefixes)
    ) {
      continue;
    }
    if (!isInternalUrl(absolute, ctx.startDomain)) continue;
    if (!isHtmlLikeUrl(absolute)) continue;
    if (
      !isUrlAllowedByRobots(ctx.robotsMatcher, absolute, ctx.crawlUserAgent)
    ) {
      continue;
    }
    if (!ctx.visited.has(absolute)) {
      ctx.queue.push(absolute);
    }
  }
}

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
  /** Only crawl URLs under these path prefixes; empty = entire site. */
  allowedPathPrefixes?: string[];
  /** Conditional GET + 304 replay (see `CrawlOptions.incremental`). */
  incremental?: boolean;
  /**
   * Merged into `state.resourceCache` when `state` is null (first batch) or to hydrate
   * from Redis/file without sending large caches from the client.
   */
  initialResourceCache?: Record<string, SerializableUrlCacheEntry>;
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

  const crawlUserAgent = params.userAgent || DEFAULT_CRAWL_USER_AGENT;
  const robotsUrl = new URL("/robots.txt", startDomain).toString();

  let robotsTxtCached: string | null | undefined = params.state?.robotsTxtCached;
  let robotsMatcher: RobotsMatcher | null;
  if (robotsTxtCached === undefined) {
    const loaded = await fetchRobotsMatcher(startDomain, {
      userAgent: crawlUserAgent,
      requestTimeoutMs: params.requestTimeoutMs
    });
    robotsTxtCached = loaded.raw;
    robotsMatcher = loaded.matcher;
  } else {
    robotsMatcher = matcherFromCachedRaw(robotsUrl, robotsTxtCached);
  }

  const effectiveDelayMs = getEffectiveCrawlDelayMs(
    robotsMatcher,
    crawlUserAgent,
    params.delayMs
  );

  const visited = new Set<string>(params.state?.visited ?? []);
  const queue = [...(params.state?.queue ?? [])];
  const incremental = params.incremental ?? false;
  const resourceCache: Record<string, SerializableUrlCacheEntry> = incremental
    ? {
        ...(params.initialResourceCache ?? {}),
        ...(params.state?.resourceCache ?? {})
      }
    : {};

  if (!params.state) {
    if (params.startUrls.length > 0) {
      for (const u of params.startUrls) {
        const n = normaliseUrl(u, startDomain);
        if (
          n &&
          isUrlAllowedByRobots(robotsMatcher, n, crawlUserAgent)
        ) {
          queue.push(n);
        }
      }
    } else if (isUrlAllowedByRobots(robotsMatcher, startDomain, crawlUserAgent)) {
      queue.push(startDomain);
    }
  }

  const newPages: PageData[] = [];
  const pathPrefixes = params.allowedPathPrefixes ?? [];

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
    if (shouldSkipCrawlUrl(normalised)) {
      continue;
    }

    try {
      if (params.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, params.delayMs));
      }

      const cacheEntry = incremental ? resourceCache[normalised] : undefined;
      const canConditional =
        incremental &&
        Boolean(cacheEntry?.pageData) &&
        Boolean(cacheEntry?.etag || cacheEntry?.lastModified);

      let res = await axios.get<string>(normalised, {
        maxRedirects: 5,
        timeout: params.requestTimeoutMs,
        validateStatus: () => true,
        headers: canConditional
          ? buildBrowserHeaders(params.userAgent, cacheEntry)
          : defaultBrowserHeaders(params.userAgent)
      });

      let status = res.status;

      if (incremental && status === 304) {
        const cached = resourceCache[normalised];
        if (cached?.pageData) {
          const pageData = cached.pageData;
          if (pageData.robots.noindex) {
            console.info("Skipping noindex page (304 cache)", { url: normalised });
            continue;
          }
          if (params.alreadyCollected + newPages.length < params.maxPagesTotal) {
            newPages.push(pageData);
          }
          enqueueLinksFromPageData(pageData, {
            startDomain,
            followLinks: params.followLinks,
            pathPrefixes,
            robotsMatcher,
            crawlUserAgent,
            visited,
            queue
          });
          continue;
        }
        res = await axios.get<string>(normalised, {
          maxRedirects: 5,
          timeout: params.requestTimeoutMs,
          validateStatus: () => true,
          headers: defaultBrowserHeaders(params.userAgent)
        });
        status = res.status;
      }

      const html = typeof res.data === "string" ? res.data : "";

      if (status === 403 || status === 401 || status === 429) {
        throw new CrawlFatalError(
          `Blocked (HTTP ${status}) when fetching ${normalised}. ` +
            `Sites on Cloudflare (and similar) often block automated requests from cloud/datacenter IPs (e.g. Vercel). ` +
            `Try running the app locally with \`npm run dev\`, enable "Use sitemap URLs only" (smaller crawl), or a residential VPN.`
        );
      }

      if (status !== 200) {
        if (status === 304) {
          console.warn("Unexpected 304 without usable cache; skipping", {
            url: normalised
          });
          continue;
        }
        if (status >= 400 && status < 500) {
          throw new CrawlFatalError(
            `HTTP ${status} when fetching ${normalised}. The server refused this request (bot or rate limit).`
          );
        }
        if (status >= 500) {
          console.warn("HTTP server error, skipping", { url: normalised, status });
          continue;
        }
        console.warn("Skipping unexpected HTTP status", { url: normalised, status });
        continue;
      }

      if (isLikelyBotChallengePage(html)) {
        throw new CrawlFatalError(
          `Bot challenge page when fetching ${normalised} (often Cloudflare / JavaScript check). ` +
            `This tool does not run JavaScript. Requests from cloud hosts are often blocked; try \`npm run dev\` on your PC or use sitemap-only mode.`
        );
      }

      const contentType = res.headers["content-type"] || "";
      if (!contentType.includes("text/html")) {
        console.warn("Skipping non-HTML content", {
          url: normalised,
          status: res.status,
          contentType
        });
        continue;
      }
      const pageData = extractPageData(normalised, html, startDomain);

      if (pageData.robots.noindex) {
        console.info("Skipping noindex page", { url: normalised });
        continue;
      }

      if (params.alreadyCollected + newPages.length < params.maxPagesTotal) {
        newPages.push(pageData);
      }

      if (incremental) {
        resourceCache[normalised] = recordCacheEntry(pageData, res.headers as Record<string, unknown>);
      }

      const $ = cheerio.load(html);
      const linkBase = getLinkResolutionBase(html, normalised);
      if (params.followLinks) {
        $("a[href]").each((_, el) => {
          const href = $(el).attr("href");
          if (!href || shouldIgnoreHref(href)) return;
          const absolute = normaliseUrl(href, linkBase);
          if (!absolute) return;
          if (shouldSkipCrawlUrl(absolute)) return;
          if (pathPrefixes.length > 0 && !isUrlPathUnderPrefixes(absolute, pathPrefixes)) {
            return;
          }
          if (!isInternalUrl(absolute, startDomain)) return;
          if (!isHtmlLikeUrl(absolute)) return;
          if (!isUrlAllowedByRobots(robotsMatcher, absolute, crawlUserAgent)) {
            return;
          }
          if (!visited.has(absolute)) {
            queue.push(absolute);
          }
        });
      }
    } catch (error) {
      if (error instanceof CrawlFatalError) throw error;
      console.error("Crawl error", { url: normalised, error });
      continue;
    }
  }

  const atCap =
    params.alreadyCollected + newPages.length >= params.maxPagesTotal;
  const complete = queue.length === 0 || atCap;

  const baseState: SerializableCrawlState = {
    queue,
    visited: Array.from(visited),
    robotsTxtCached: robotsTxtCached ?? null
  };
  if (incremental) {
    baseState.resourceCache = resourceCache;
  }

  return {
    newPages,
    state: baseState,
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
    requestTimeoutMs = 15000,
    allowedPathPrefixes,
    onProgress,
    incremental = false
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
  let batchIndex = 0;

  const initialResourceCache =
    incremental && isIncrementalPersistenceAvailable()
      ? await loadUrlCache(startDomain)
      : undefined;

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
      state,
      allowedPathPrefixes,
      incremental,
      initialResourceCache: state ? undefined : initialResourceCache
    });
    all.push(...batch.newPages);
    state = batch.state;
    complete = batch.complete;
    batchIndex += 1;

    if (incremental && isIncrementalPersistenceAvailable()) {
      await saveUrlCache(startDomain, batch.state.resourceCache ?? {});
    }

    await onProgress?.({
      pagesCollected: all.length,
      maxPages,
      batchIndex
    });
  }

  return all;
}


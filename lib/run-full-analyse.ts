import type {
  AnalyseResponseBody,
  AnalyseRequestBody,
  KeywordMapping
} from "@/types";
import { crawlSite } from "@/lib/crawler";
import { parseSitemapUrls } from "@/lib/sitemap";
import { normaliseUrl } from "@/lib/url";
import { cleanKeywordMappings } from "@/lib/clean-mappings";
import { buildAnalyseResponse } from "@/lib/build-analyse-response";
import {
  buildCrawlStartUrls,
  normalizePathPrefixesList
} from "@/lib/path-prefixes";

export type FullAnalyseProgress = {
  pagesCollected: number;
  maxPages: number;
  batchIndex: number;
};

export type RunFullAnalyseArgs = AnalyseRequestBody & {
  /** Already-cleaned mappings (optional — if omitted, cleaned from keywordMappings). */
  cleanedMappings?: KeywordMapping[];
  onProgress?: (info: FullAnalyseProgress) => void | Promise<void>;
};

/**
 * Shared crawl + analyse pipeline (single-shot API, Redis worker, etc.).
 */
export async function runFullAnalyse(
  args: RunFullAnalyseArgs
): Promise<AnalyseResponseBody> {
  const {
    domain,
    sitemapUrl,
    maxPages = 100,
    keywordMappings,
    cleanedMappings: preCleaned,
    userAgent,
    sitemapOnly,
    gscByKeyword: rawGsc,
    allowedPathPrefixes: rawPrefixes,
    onProgress,
    useWorkerQueue: _useWorkerQueue,
    batchPageLimit: _batchPageLimit,
    incremental = false
  } = args;

  const cleanedMappings =
    preCleaned ?? cleanKeywordMappings(keywordMappings);

  if (cleanedMappings.length === 0) {
    throw new Error("At least one valid keyword mapping is required.");
  }

  const normalisedDomain = normaliseUrl(domain);
  if (!normalisedDomain) {
    throw new Error("Invalid domain.");
  }

  const limitedMaxPages = Math.min(Math.max(maxPages || 1, 1), 500);
  const allowedPathPrefixes = normalizePathPrefixesList(rawPrefixes ?? []);

  let sitemapUrls: string[] = [];
  if (sitemapUrl) {
    sitemapUrls = await parseSitemapUrls(sitemapUrl, normalisedDomain);
  }
  const initialQueue = buildCrawlStartUrls(
    normalisedDomain,
    sitemapUrls,
    allowedPathPrefixes
  );
  if (initialQueue.length === 0) {
    throw new Error(
      "No crawl start URLs match your path-prefix filters. Add a sitemap or adjust paths."
    );
  }

  const onVercel = process.env.VERCEL === "1";

  const pages = await crawlSite({
    domain: normalisedDomain,
    sitemapUrl,
    maxPages: limitedMaxPages,
    startUrls: initialQueue,
    userAgent,
    followLinks: sitemapOnly ? false : true,
    delayMs: onVercel ? 0 : 250,
    requestTimeoutMs: onVercel ? 10000 : 15000,
    allowedPathPrefixes:
      allowedPathPrefixes.length > 0 ? allowedPathPrefixes : undefined,
    onProgress,
    incremental: Boolean(incremental)
  });

  return buildAnalyseResponse({
    pages,
    keywordMappings: cleanedMappings,
    gscByKeyword: rawGsc
  });
}

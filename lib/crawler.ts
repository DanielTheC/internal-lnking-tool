import axios from "axios";
import type { CrawlOptions, PageData } from "@/types";
import { extractPageData } from "./extractor";
import { isHtmlLikeUrl, isInternalUrl, normaliseUrl, shouldIgnoreHref } from "./url";
import * as cheerio from "cheerio";

export async function crawlSite(options: CrawlOptions): Promise<PageData[]> {
  const {
    domain,
    sitemapUrl,
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

  const visited = new Set<string>();
  const queue: string[] = [];

  if (startUrls && startUrls.length > 0) {
    for (const u of startUrls) {
      const n = normaliseUrl(u, startDomain);
      if (n) queue.push(n);
    }
  } else {
    queue.push(startDomain);
  }

  const pages: PageData[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const current = queue.shift()!;
    const normalised = normaliseUrl(current);
    if (!normalised) continue;
    if (visited.has(normalised)) continue;
    visited.add(normalised);

    try {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const res = await axios.get<string>(normalised, {
        maxRedirects: 5,
        timeout: requestTimeoutMs,
        // Some sites return 3xx/4xx with HTML we can still parse.
        validateStatus: (s) => s >= 200 && s < 500,
        headers: {
          "User-Agent":
            userAgent ||
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

      pages.push(pageData);

      const $ = cheerio.load(html);
      if (followLinks) {
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

  return pages;
}


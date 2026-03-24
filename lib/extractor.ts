import * as cheerio from "cheerio";
import type { PageData, RobotsDirectives } from "@/types";
import {
  getLinkResolutionBase,
  isInternalUrl,
  normaliseUrl,
  shouldIgnoreHref,
  shouldSkipCrawlUrl
} from "./url";

function parseRobotsDirectives($: cheerio.CheerioAPI): RobotsDirectives {
  const directives: RobotsDirectives = { noindex: false, nofollow: false };
  const metaRobots = $('meta[name="robots"]').attr("content");
  if (metaRobots) {
    const tokens = metaRobots.toLowerCase().split(/[, ]+/);
    directives.noindex = tokens.includes("noindex");
    directives.nofollow = tokens.includes("nofollow");
  }
  return directives;
}

function extractMainContent($: cheerio.CheerioAPI) {
  const main = $("main");
  if (main.length) return main;
  const article = $("article");
  if (article.length) return article;
  return $("body");
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function extractPageData(
  url: string,
  html: string,
  domain: string
): PageData {
  const $ = cheerio.load(html);

  const title = $("title").first().text() || null;
  const metaTitle = $('meta[property="og:title"]').attr("content") || null;
  const h1 = $("h1").first().text() || null;

  const robots = parseRobotsDirectives($);
  const canonicalHref = $('link[rel="canonical"]').attr("href") || null;
  const canonicalUrl = canonicalHref ? normaliseUrl(canonicalHref, url) : null;

  const main = extractMainContent($);

  const linkBase = getLinkResolutionBase(html, url);

  main.find("header, footer, nav, aside").remove();
  main.find("script, style, noscript").remove();

  const bodyText = cleanText(main.text());

  const mainWithoutAnchors = main.clone();
  mainWithoutAnchors.find("a").remove();
  const bodyTextWithoutAnchors = cleanText(mainWithoutAnchors.text());

  const mainForBlocks = main.clone();
  mainForBlocks.find("header, footer, nav, aside").remove();
  mainForBlocks.find("script, style, noscript").remove();
  mainForBlocks.find("a").remove();
  const contentBlocks: string[] = [];
  mainForBlocks.find("p").each((_, el) => {
    const t = cleanText($(el).text());
    if (t.length > 0) contentBlocks.push(t);
  });
  if (contentBlocks.length === 0) {
    const fallback = cleanText(mainForBlocks.text());
    if (fallback.length > 0) contentBlocks.push(fallback);
  }

  const outgoingInternalLinks = new Set<string>();
  const internalAnchors: { href: string; text: string }[] = [];
  main.find("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || shouldIgnoreHref(href)) return;
    const absolute = normaliseUrl(href, linkBase);
    if (!absolute) return;
    if (shouldSkipCrawlUrl(absolute)) return;
    if (!isInternalUrl(absolute, domain)) return;
    outgoingInternalLinks.add(absolute);
    const text = cleanText($(el).text());
    if (text) {
      internalAnchors.push({ href: absolute, text });
    }
  });

  return {
    url,
    finalUrl: url,
    title,
    metaTitle,
    h1,
    bodyText,
    bodyTextWithoutAnchors,
    contentBlocks,
    outgoingInternalLinks: Array.from(outgoingInternalLinks),
    internalAnchors,
    canonicalUrl,
    robots
  };
}


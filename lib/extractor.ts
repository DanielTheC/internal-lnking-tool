import * as cheerio from "cheerio";
import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
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

/**
 * Region used for body text, paragraph blocks, and in-body internal anchors (not the full chrome shell).
 * Many SFCC / Demandware sites use &lt;div role="main" id="maincontent"&gt; instead of &lt;main&gt;.
 */
function extractEditorialContentRoot($: cheerio.CheerioAPI): Cheerio<AnyNode> {
  const mainEl = $("main").first();
  if (mainEl.length) return mainEl;
  const landmark = $('[role="main"]').first();
  if (landmark.length) return landmark;
  const mainContent = $("#maincontent").first();
  if (mainContent.length) return mainContent;
  const article = $("article").first();
  if (article.length) return article;
  return $("body");
}

/** Full page (minus global chrome) for crawl &lt;a&gt; discovery — keeps header/footer-stripped body. */
function extractLinkScopeRoot($: cheerio.CheerioAPI): Cheerio<AnyNode> {
  return $("body");
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Remove faceted search / PLP filter regions that often live inside &lt;main&gt; (not in &lt;nav&gt;).
 * Keyword hits there are not editorial internal-linking context.
 */
function stripFacetedFilterRegions(root: Cheerio<AnyNode>): void {
  const selectors = [
    "[data-facet]",
    "[data-facets]",
    "[data-faceted]",
    "[data-facet-filters]",
    "[data-filter]",
    "[data-filter-group]",
    '[aria-label*="filter"]',
    '[aria-label*="Filter"]',
    '[aria-label*="refine"]',
    '[aria-label*="Refine"]',
    '[id*="facet"]',
    '[id*="Facet"]',
    '[id*="facets"]',
    '[id*="Facets"]',
    '[class*="facet-filter"]',
    '[class*="FacetFilters"]',
    '[class*="facets__"]',
    '[class*="collection-filters"]',
    '[class*="product-filters"]',
    '[class*="plp-filters"]',
    '[class*="searchspring-facet"]',
    ".refinements",
    ".active-facets",
    "#FacetFiltersForm",
    'form[action*="facet"]'
  ].join(", ");
  root.find(selectors).remove();
}

/**
 * Breadcrumbs often sit in &lt;main&gt; as a div/ol (not semantic &lt;nav&gt;) — remove before body text / &lt;p&gt; blocks.
 */
function stripBreadcrumbRegions(
  root: Cheerio<AnyNode>,
  $: cheerio.CheerioAPI
): void {
  const selectors = [
    "[itemtype*='BreadcrumbList']",
    "[itemtype*='breadcrumb']",
    'nav[aria-label*="Breadcrumb"]',
    'nav[aria-label*="breadcrumb"]',
    'nav[aria-label*="bread crumb"]',
    '[role="navigation"][aria-label*="Breadcrumb"]',
    '[role="navigation"][aria-label*="breadcrumb"]',
    '[data-testid*="breadcrumb"]',
    '[data-test*="breadcrumb"]',
    '[class*="breadcrumb"]',
    '[class*="Breadcrumb"]',
    '[id*="breadcrumb"]',
    '[id*="Breadcrumb"]',
    ".breadcrumbs",
    "#breadcrumbs",
    ".bread-crumb",
    ".page-breadcrumb",
    '[data-section-type="breadcrumb"]',
    "[data-breadcrumb]",
    "[data-component='breadcrumb']",
    '[class*="shopify-section-group-breadcrumb"]'
  ].join(", ");
  root.find(selectors).remove();

  /** CSS [class*=…] is case-sensitive — catch BreadCrumbs, __breadcrumb__, etc. */
  const attrNeedles = [
    "breadcrumb",
    "bread-crumb",
    "bread_crumb",
    "breadcrums",
    "crumb-trail",
    "crumbtrail"
  ];
  const toRemoveAttr: unknown[] = [];
  root.find("[class], [id], [data-section-type], [data-component], [data-module]").each(
    (_, el) => {
      const $el = $(el);
      const hay = [
        $el.attr("class"),
        $el.attr("id"),
        $el.attr("data-section-type"),
        $el.attr("data-component"),
        $el.attr("data-module")
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (attrNeedles.some((n) => hay.includes(n))) {
        toRemoveAttr.push(el);
      }
    }
  );
  for (const el of toRemoveAttr) {
    $(el as never).remove();
  }

  /** Schema.org trail: multiple itemListElement under one list — common breadcrumb pattern. */
  root.find("ol, ul").each((_, el) => {
    const $list = $(el);
    const items = $list.find('[itemprop="itemListElement"]');
    if (items.length >= 2) {
      $list.remove();
    }
  });

  stripFlatShortLinkListsLooksLikeBreadcrumb(root, $);
  stripBreadcrumbLikeCompactBlocks(root, $);
}

/**
 * Many themes use &lt;ol&gt;/&lt;ul&gt; + short &lt;li&gt; crumbs with no "/" or "&gt;" in the combined text,
 * so trail heuristics miss them. Remove only flat, shallow lists with multiple internal-style links.
 */
function stripFlatShortLinkListsLooksLikeBreadcrumb(
  root: Cheerio<AnyNode>,
  $: cheerio.CheerioAPI
): void {
  const skipList =
    '[class*="product"], [class*="products"], [class*="grid"], [class*="carousel"], ' +
    '[class*="pagination"], [class*="pager"], [aria-label*="pagination"], ' +
    '[class*="thumbnail"], [class*="social"], [class*="share"], ' +
    '[class*="related"], [class*="see-also"], [class*="also-read"], ' +
    ".pagination, .pager";

  root.find("ol, ul").each((_, el) => {
    const $list = $(el);
    if ($list.closest("header, footer, nav, aside").length) return;
    if ($list.is(skipList) || $list.closest(skipList).length) return;
    if ($list.parents("li").length) return;

    const lis = $list.children("li");
    const n = lis.length;
    if (n < 2 || n > 12) return;
    if ($list.find("table, form, iframe, picture").length) return;
    if ($list.find("li ol, li ul").length) return;

    const maxLi = 72;
    let allShort = true;
    let anchorCount = 0;
    lis.each((__, li) => {
      const $li = $(li);
      const liText = cleanText($li.text());
      if (liText.length > maxLi || /[.!?][\s\u00A0]+[A-Za-z]/.test(liText)) {
        allShort = false;
      }
      anchorCount += $li.find("a[href]").length;
    });
    if (!allShort) return;
    if (anchorCount >= 2 && anchorCount >= n - 1) {
      $list.remove();
    }
  });
}

/** Short slash / chevron trails with multiple links (missed by class selectors). */
function isBreadcrumbLikeTrailText(t: string): boolean {
  const trimmed = t.trim();
  if (trimmed.length < 6 || trimmed.length > 320) return false;
  if (/[.!?]\s+[A-Za-z]/.test(trimmed)) return false;

  const slashSegs = trimmed
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    slashSegs.length >= 2 &&
    slashSegs.length <= 16 &&
    slashSegs.every((s) => s.length <= 55)
  ) {
    return true;
  }

  const gtSegs = trimmed
    .split(/\s*[>›»·•]\s*|\s+[·•]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    gtSegs.length >= 2 &&
    gtSegs.length <= 16 &&
    gtSegs.every((s) => s.length <= 55)
  ) {
    return true;
  }

  return false;
}

function stripBreadcrumbLikeCompactBlocks(
  root: Cheerio<AnyNode>,
  $: cheerio.CheerioAPI
): void {
  const toRemove: unknown[] = [];

  root.find("p, ol, ul, div, span").each((_, el) => {
    const $e = $(el);
    if ($e.closest("header, footer, nav, aside").length) return;
    if ($e.find("table, form, iframe, picture, video, h1, h2, h3, h4").length) {
      return;
    }
    const t = cleanText($e.text());
    if (!isBreadcrumbLikeTrailText(t)) return;

    const nA = $e.find("a[href]").length;
    const tag = String(el.tagName || "").toLowerCase();

    if (tag === "p" || tag === "span") {
      if (nA >= 2 || (nA >= 1 && t.includes("/"))) {
        toRemove.push(el);
      }
      return;
    }

    if (tag === "ol" || tag === "ul") {
      if (nA >= 2) toRemove.push(el);
      return;
    }

    if (tag === "div") {
      const shallowBlocks = $e.find("div, section, article").length;
      if (shallowBlocks === 0 && nA >= 2) {
        toRemove.push(el);
      }
      if (shallowBlocks === 0 && nA === 1 && t.includes("/") && t.length < 200) {
        toRemove.push(el);
      }
    }
  });

  for (const el of toRemove) {
    $(el as never).remove();
  }
}

/**
 * PLP title echoes category keywords; horizontal "shop subcategories" rails look like breadcrumbs to analysts.
 * Strip only common listing-page wrappers so PDP / editorial pages are largely untouched.
 */
function stripPlpHeadingAndCategoryRail(root: Cheerio<AnyNode>): void {
  root
    .find(
      [
        ".row.plp-title-container",
        ".plp-title-container",
        ".header-cat-container",
        ".cat-list.horizontal-scrollbar",
        '[class*="plp-subcategory"]',
        '[class*="category-ribbon"]',
        '[data-widget="subcategory-navigation"]'
      ].join(", ")
    )
    .remove();
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

  const linkScope = extractLinkScopeRoot($);
  const editorialRoot = extractEditorialContentRoot($);

  const linkBase = getLinkResolutionBase(html, url);

  linkScope.find("header, footer, nav, aside").remove();
  linkScope.find("script, style, noscript").remove();

  /**
   * Crawl frontier: internal hrefs from the cleaned page shell (includes PLP filters, category rails, etc.).
   * In-body anchor classification uses `editorialRoot` after stripping non-editorial UI.
   */
  const outgoingInternalLinks = new Set<string>();
  linkScope.find("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || shouldIgnoreHref(href)) return;
    const absolute = normaliseUrl(href, linkBase);
    if (!absolute) return;
    if (shouldSkipCrawlUrl(absolute)) return;
    if (!isInternalUrl(absolute, domain)) return;
    outgoingInternalLinks.add(absolute);
  });

  stripFacetedFilterRegions(editorialRoot);
  stripBreadcrumbRegions(editorialRoot, $);
  stripPlpHeadingAndCategoryRail(editorialRoot);

  const internalAnchors: { href: string; text: string }[] = [];
  editorialRoot.find("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || shouldIgnoreHref(href)) return;
    const absolute = normaliseUrl(href, linkBase);
    if (!absolute) return;
    if (shouldSkipCrawlUrl(absolute)) return;
    if (!isInternalUrl(absolute, domain)) return;
    const text = cleanText($(el).text());
    if (text) {
      internalAnchors.push({ href: absolute, text });
    }
  });

  const bodyText = cleanText(editorialRoot.text());

  const mainWithoutAnchors = editorialRoot.clone();
  mainWithoutAnchors.find("a").remove();
  const bodyTextWithoutAnchors = cleanText(mainWithoutAnchors.text());

  const mainForBlocks = editorialRoot.clone();
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


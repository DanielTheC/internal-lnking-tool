export type CrawlOptions = {
  domain: string;
  sitemapUrl?: string;
  maxPages?: number;
  startUrls?: string[];
  userAgent?: string;
  followLinks?: boolean;
  delayMs?: number;
  /** Per-request HTTP timeout (ms). Lower on serverless to fail fast within platform limits. */
  requestTimeoutMs?: number;
  /**
   * Only crawl URLs whose path starts with one of these prefixes (e.g. `/blog`, `/sale`).
   * Empty = full site. Prefix `/` = whole site explicitly.
   */
  allowedPathPrefixes?: string[];
  /** Called after each internal crawl batch (Redis worker / progress UI). */
  onProgress?: (info: {
    pagesCollected: number;
    maxPages: number;
    batchIndex: number;
  }) => void | Promise<void>;
  /**
   * Use conditional GET (If-None-Match / If-Modified-Since) and reuse cached PageData on 304.
   * Persists per-origin in Redis when `REDIS_URL` is set, or `.cache/crawl-incremental/` in dev.
   */
  incremental?: boolean;
};

export type RobotsDirectives = {
  noindex: boolean;
  nofollow: boolean;
};

export type PageData = {
  url: string;
  finalUrl: string;
  title: string | null;
  metaTitle: string | null;
  h1: string | null;
  bodyText: string;
  bodyTextWithoutAnchors: string;
  /** Text per &lt;p&gt; (etc.) for paragraph-level scoring; built from main content without anchors. */
  contentBlocks?: string[];
  outgoingInternalLinks: string[];
  internalAnchors: {
    href: string;
    text: string;
  }[];
  canonicalUrl: string | null;
  robots: RobotsDirectives;
};

export type KeywordMatchMode = "exact" | "phrase";

export type KeywordMapping = {
  keyword: string;
  destinationUrl: string;
  matchMode: KeywordMatchMode;
  group?: string;
};

/** Aggregated Search Console stats per query (keyword), after CSV import. */
export type GscKeywordMetrics = {
  impressions: number;
  clicks: number;
  /** Impression-weighted average position when available. */
  position?: number;
};

export type OpportunityStatus =
  | "Opportunity found"
  | "Strong link"
  | "Weak anchor"
  | "Source equals destination"
  | "Keyword not found"
  | "Linked to different URL";

export type OpportunityResult = {
  keyword: string;
  group?: string;
  sourceUrl: string;
  sourceTitle: string | null;
  destinationUrl: string;
  snippet: string | null;
  status: OpportunityStatus;
  score: number;
  /**
   * 0–1: editorial / sentence-like strength of the keyword match (vs boilerplate).
   * Derived from the best matching content block when available.
   */
  contextQuality?: number;
  cannibalisationRisk?: boolean;
  gscImpressions?: number;
  gscClicks?: number;
  gscPosition?: number;
};

export type AnalyseRequestBody = {
  domain: string;
  sitemapUrl?: string;
  maxPages?: number;
  keywordMappings: KeywordMapping[];
  userAgent?: string;
  sitemapOnly?: boolean;
  /** Optional: keyed by normalised query string (lowercase), from GSC CSV import. */
  gscByKeyword?: Record<string, GscKeywordMetrics>;
  /** New pages per /api/crawl/batch call when using chunked crawl (default 15). */
  batchPageLimit?: number;
  /** Only follow and index URLs under these path prefixes (see `lib/path-prefixes.ts`). */
  allowedPathPrefixes?: string[];
  /**
   * When true and the server exposes a Redis crawl queue, use a background worker
   * instead of many `/api/crawl/batch` calls (no 400-step browser limit).
   */
  useWorkerQueue?: boolean;
  /** Skip unchanged pages via ETag / Last-Modified (see `CrawlOptions.incremental`). */
  incremental?: boolean;
};

/** Edge classification for the topical map (Phase 1). */
export type TopicalMapEdgeKind =
  | "observed"
  | "suggestion_opportunity"
  | "suggestion_weak"
  | "suggestion_strong"
  | "suggestion_linked_elsewhere"
  | "suggestion_other";

export type TopicalMapNode = {
  id: string;
  url: string;
  title: string | null;
  h1: string | null;
  /** Primary label: H1, else title, else path. */
  displayLabel: string;
  /** False when stubbed from links/opportunities not returned as crawled pages. */
  crawled: boolean;
};

export type TopicalMapEdge = {
  id: string;
  source: string;
  target: string;
  kind: TopicalMapEdgeKind;
  keywords: string[];
  statuses: OpportunityStatus[];
};

export type AnalyseGraphPayload = {
  nodes: TopicalMapNode[];
  edges: TopicalMapEdge[];
};

export type AnalyseResponseBody = {
  crawledPageCount: number;
  totalKeywordMappingsAnalysed: number;
  totalOpportunitiesFound: number;
  results: OpportunityResult[];
  /** Crawl graph + suggestions for the topical map UI (optional for older saved runs). */
  graph?: AnalyseGraphPayload;
};

/**
 * Stored per normalised URL for incremental crawls: validators + last successful PageData
 * (needed to honour HTTP 304 without a response body).
 */
export type SerializableUrlCacheEntry = {
  etag: string | null;
  lastModified: string | null;
  pageData: PageData;
  /** Epoch ms when this entry was last written (LRU trim / debugging). */
  savedAt: number;
};

/** Serialisable crawl frontier for chunked /api/crawl/batch requests. */
export type SerializableCrawlState = {
  queue: string[];
  visited: string[];
  /**
   * Cached `robots.txt` body for this origin (`null` = fetched 404 / no file).
   * Omitted only on the very first batch before load.
   */
  robotsTxtCached?: string | null;
  /**
   * URL → validators + cached page snapshot. Omitted when using server-side persistence
   * for incremental mode (Redis / file) so batch clients do not ship large payloads.
   */
  resourceCache?: Record<string, SerializableUrlCacheEntry>;
};

export type CrawlBatchRequestBody = {
  domain: string;
  sitemapUrl?: string;
  maxPages: number;
  userAgent?: string;
  sitemapOnly?: boolean;
  alreadyCollected: number;
  /** Soft cap on new PageData rows per invocation (stay under serverless timeouts). Default 15 on the server. */
  batchPageLimit?: number;
  state: SerializableCrawlState | null;
  allowedPathPrefixes?: string[];
  incremental?: boolean;
};

export type CrawlBatchResponseBody = {
  newPages: PageData[];
  state: SerializableCrawlState;
  complete: boolean;
};


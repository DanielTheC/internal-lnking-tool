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
};

export type AnalyseResponseBody = {
  crawledPageCount: number;
  totalKeywordMappingsAnalysed: number;
  totalOpportunitiesFound: number;
  results: OpportunityResult[];
};


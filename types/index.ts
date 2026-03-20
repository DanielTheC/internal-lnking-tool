export type CrawlOptions = {
  domain: string;
  sitemapUrl?: string;
  maxPages?: number;
  startUrls?: string[];
  userAgent?: string;
  followLinks?: boolean;
  delayMs?: number;
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

export type OpportunityStatus =
  | "Opportunity found"
  | "Already linked"
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
};

export type AnalyseRequestBody = {
  domain: string;
  sitemapUrl?: string;
  maxPages?: number;
  keywordMappings: KeywordMapping[];
  userAgent?: string;
  sitemapOnly?: boolean;
};

export type AnalyseResponseBody = {
  crawledPageCount: number;
  totalKeywordMappingsAnalysed: number;
  totalOpportunitiesFound: number;
  results: OpportunityResult[];
};


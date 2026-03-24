import { normaliseUrl } from "@/lib/url";

/** Normalise a path prefix: `/blog`, leading slash, trim slashes except `/`. */
export function normalizePathPrefix(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  let p = t.startsWith("/") ? t : `/${t}`;
  if (p.length > 1) {
    p = p.replace(/\/+$/, "");
  }
  return p || "/";
}

/**
 * Parse textarea / CSV input into unique path prefixes.
 * Lines or commas; e.g. `/blog`, `mens-boots`, `/sale/outdoor`
 */
export function parsePathPrefixesField(raw: string): string[] {
  if (!raw.trim()) return [];
  const parts = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return normalizePathPrefixesList(parts);
}

const MAX_PREFIXES = 50;

export function normalizePathPrefixesList(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (out.length >= MAX_PREFIXES) break;
    const n = normalizePathPrefix(r);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function normalizePathnameForMatch(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

/**
 * Whether `url`'s path is allowed under any of the prefixes.
 * Empty `prefixes` = allow all.
 * Prefix `/` = whole site.
 */
export function isUrlPathUnderPrefixes(url: string, prefixes: string[]): boolean {
  if (prefixes.length === 0) return true;
  const normalized = normalizePathPrefixesList(prefixes);
  if (normalized.length === 0) return true;
  if (normalized.includes("/")) return true;

  let path: string;
  try {
    path = normalizePathnameForMatch(new URL(url).pathname);
  } catch {
    return false;
  }

  for (const prefix of normalized) {
    if (prefix === "/") return true;
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const n = normaliseUrl(u);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * Build seed URLs for the first crawl batch: sitemap filtered by prefix, or
 * homepage, or one URL per prefix under the domain.
 */
export function buildCrawlStartUrls(
  normalisedDomain: string,
  sitemapUrls: string[],
  allowedPathPrefixes: string[]
): string[] {
  const prefixes = normalizePathPrefixesList(allowedPathPrefixes);

  if (prefixes.length === 0) {
    if (sitemapUrls.length > 0) return dedupeUrls(sitemapUrls);
    return [normalisedDomain];
  }

  if (prefixes.includes("/")) {
    if (sitemapUrls.length > 0) return dedupeUrls(sitemapUrls);
    return [normalisedDomain];
  }

  const fromSitemap = sitemapUrls.filter((u) =>
    isUrlPathUnderPrefixes(u, prefixes)
  );
  if (fromSitemap.length > 0) return dedupeUrls(fromSitemap);

  const seeds: string[] = [];
  for (const prefix of prefixes) {
    if (prefix === "/") continue;
    const u = normaliseUrl(prefix, normalisedDomain);
    if (u) seeds.push(u);
  }
  return dedupeUrls(seeds);
}

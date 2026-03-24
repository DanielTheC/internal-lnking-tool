const HTML_EXTENSIONS = ["", ".html", ".htm", "/"];

/**
 * If `href` has no scheme but looks like `www.site.com/path` or `site.com/path`,
 * prepend `https://`. Otherwise the URL API resolves `www.site.com/foo` relative to
 * the current page and produces broken paths like `/editorial/campaigns/www.site.com/foo`.
 */
function coerceSchemelessHostnameHref(rawUrl: string): string {
  const t = rawUrl.trim();
  if (!t) return t;
  if (
    /^https?:\/\//i.test(t) ||
    t.startsWith("//") ||
    t.startsWith("/") ||
    t.startsWith("#") ||
    t.startsWith("?")
  ) {
    return t;
  }
  if (/^(mailto|tel|javascript):/i.test(t)) {
    return t;
  }
  if (/^www\.[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(t)) {
    return `https://${t}`;
  }
  if (/^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\//.test(t)) {
    return `https://${t}`;
  }
  return t;
}

/**
 * HTML `<base href>` changes how relative URLs resolve; Cheerio does not apply it automatically.
 */
export function getLinkResolutionBase(html: string, documentUrl: string): string {
  const m = html.match(/<base[^>]*\s+href\s*=\s*["']([^"']+)["']/i);
  if (!m?.[1]) return documentUrl;
  const resolved = normaliseUrl(m[1].trim(), documentUrl);
  return resolved || documentUrl;
}

export function normaliseUrl(rawUrl: string, baseDomain?: string): string | null {
  try {
    const prepared = coerceSchemelessHostnameHref(rawUrl);
    const url =
      prepared.startsWith("http://") || prepared.startsWith("https://")
        ? new URL(prepared)
        : baseDomain
        ? new URL(prepared, baseDomain)
        : null;

    if (!url) return null;

    url.hash = "";

    if (url.protocol === "http:") {
      url.protocol = "https:";
    }

    let pathname = url.pathname;
    if (pathname !== "/") {
      pathname = pathname.replace(/\/+$/, "");
    }
    url.pathname = pathname || "/";

    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Compare hosts so `www.example.com` matches `example.com` (common crawl bug otherwise).
 * Subdomains other than leading `www` stay distinct (e.g. `blog.` vs `www.`).
 */
function hostKeyForInternalLink(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

export function isInternalUrl(url: string, domain: string): boolean {
  try {
    const u = new URL(url);
    const d = new URL(domain);
    return hostKeyForInternalLink(u.hostname) === hostKeyForInternalLink(d.hostname);
  } catch {
    return false;
  }
}

export function isHtmlLikeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (path.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|pdf|zip|mp4|mp3|woff2?)$/)) {
      return false;
    }
    const extMatch = path.match(/\.[a-z0-9]+$/);
    if (!extMatch) return true;
    return HTML_EXTENSIONS.includes(extMatch[0] as any);
  } catch {
    return false;
  }
}

export function shouldIgnoreHref(href: string): boolean {
  const lower = href.toLowerCase();
  if (
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("javascript:")
  ) {
    return true;
  }
  return false;
}

/**
 * Cloudflare / CDN paths that are not real pages (email decoding, challenges, etc.).
 * Crawling them often returns 404 and breaks the batch.
 */
export function shouldSkipCrawlUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const p = u.pathname.toLowerCase();
    if (p.includes("/cdn-cgi/")) return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * Same page for internal-link purposes: ignores query/hash (Magento `?___store=`, UTM,
 * etc.), compares hosts with www normalisation, pathnames case-insensitively.
 */
export function urlsEqual(a: string, b: string): boolean {
  const na = normaliseUrl(a);
  const nb = normaliseUrl(b);
  if (!na || !nb) return false;
  try {
    const ua = new URL(na);
    const ub = new URL(nb);
    ua.search = "";
    ub.search = "";
    ua.hash = "";
    ub.hash = "";
    if (hostKeyForInternalLink(ua.hostname) !== hostKeyForInternalLink(ub.hostname)) {
      return false;
    }
    const pa = ua.pathname.replace(/\/+$/, "") || "/";
    const pb = ub.pathname.replace(/\/+$/, "") || "/";
    return pa.toLowerCase() === pb.toLowerCase();
  } catch {
    return na === nb;
  }
}


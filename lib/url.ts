import { URL } from "url";

const HTML_EXTENSIONS = ["", ".html", ".htm", "/"];

export function normaliseUrl(rawUrl: string, baseDomain?: string): string | null {
  try {
    const url =
      rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
        ? new URL(rawUrl)
        : baseDomain
        ? new URL(rawUrl, baseDomain)
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

export function isInternalUrl(url: string, domain: string): boolean {
  try {
    const u = new URL(url);
    const d = new URL(domain);
    return u.hostname === d.hostname;
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

export function urlsEqual(a: string, b: string): boolean {
  const na = normaliseUrl(a);
  const nb = normaliseUrl(b);
  if (!na || !nb) return false;
  return na === nb;
}


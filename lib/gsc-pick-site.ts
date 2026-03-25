/**
 * Pick a GSC property URL that best matches the crawl domain field.
 */
export function pickBestGscSiteUrl(
  siteUrls: string[],
  domainField: string
): string | null {
  const d = domainField.trim();
  if (!d || siteUrls.length === 0) return null;

  let host: string;
  try {
    const u = new URL(d.startsWith("http") ? d : `https://${d}`);
    host = u.hostname.toLowerCase();
  } catch {
    return null;
  }

  const candidates = new Set([
    `https://${host}/`,
    `http://${host}/`,
    `https://www.${host}/`,
    `http://www.${host}/`,
    `sc-domain:${host}`
  ]);

  for (const s of siteUrls) {
    if (candidates.has(s)) return s;
  }

  const hostNoWww = host.startsWith("www.") ? host.slice(4) : host;
  for (const s of siteUrls) {
    if (s.startsWith("sc-domain:") && s.slice("sc-domain:".length) === hostNoWww) {
      return s;
    }
  }

  for (const s of siteUrls) {
    try {
      const su = new URL(s.startsWith("http") ? s : `https://${s.replace(/^sc-domain:/, "")}`);
      if (su.hostname.replace(/^www\./, "") === host.replace(/^www\./, "")) {
        return s;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

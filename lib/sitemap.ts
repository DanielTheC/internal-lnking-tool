import axios from "axios";
import * as xml2js from "xml2js";
import { normaliseUrl } from "./url";

export async function parseSitemapUrls(
  sitemapUrl: string,
  domain: string
): Promise<string[]> {
  try {
    const res = await axios.get<string>(sitemapUrl, { timeout: 15000 });
    const xml = res.data;
    const parser = new xml2js.Parser();
    const parsed = await parser.parseStringPromise(xml);

    const urls: string[] = [];

    if (parsed.urlset && Array.isArray(parsed.urlset.url)) {
      for (const u of parsed.urlset.url) {
        const loc = u.loc?.[0];
        if (typeof loc === "string") {
          const n = normaliseUrl(loc, domain);
          if (n) urls.push(n);
        }
      }
    }

    if (parsed.sitemapindex && Array.isArray(parsed.sitemapindex.sitemap)) {
      for (const sm of parsed.sitemapindex.sitemap) {
        const loc = sm.loc?.[0];
        if (typeof loc === "string") {
          const childUrls = await parseSitemapUrls(loc, domain);
          urls.push(...childUrls);
        }
      }
    }

    return Array.from(new Set(urls));
  } catch {
    return [];
  }
}


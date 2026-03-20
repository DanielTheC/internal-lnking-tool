import { NextRequest, NextResponse } from "next/server";
import type {
  AnalyseRequestBody,
  AnalyseResponseBody,
  KeywordMapping
} from "@/types";
import { crawlSite } from "@/lib/crawler";
import { analysePagesForOpportunities } from "@/lib/analyser";
import { parseSitemapUrls } from "@/lib/sitemap";
import { normaliseUrl } from "@/lib/url";
import { applyGscToResults } from "@/lib/gsc-merge";
import type { GscKeywordMetrics } from "@/types";

/**
 * Serverless max run time (seconds). Vercel Hobby caps at ~10s regardless.
 * Vercel Pro / Enterprise can allow 60–300s — set in project settings if needed.
 */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyseRequestBody;
    const {
      domain,
      sitemapUrl,
      maxPages = 100,
      keywordMappings,
      userAgent,
      sitemapOnly,
      gscByKeyword: rawGsc
    } = body;

    if (!domain || !keywordMappings || keywordMappings.length === 0) {
      return NextResponse.json(
        { error: "Domain and at least one keyword mapping are required." },
        { status: 400 }
      );
    }

    const normalisedDomain = normaliseUrl(domain);
    if (!normalisedDomain) {
      return NextResponse.json({ error: "Invalid domain." }, { status: 400 });
    }

    const cleanedMappings: KeywordMapping[] = keywordMappings
      .map((m) => ({
        keyword: m.keyword.trim(),
        destinationUrl: m.destinationUrl.trim(),
        matchMode: m.matchMode || "phrase",
        group: m.group?.trim() || undefined
      }))
      .filter((m) => m.keyword && m.destinationUrl);

    if (cleanedMappings.length === 0) {
      return NextResponse.json(
        { error: "At least one valid keyword mapping is required." },
        { status: 400 }
      );
    }

    const limitedMaxPages = Math.min(Math.max(maxPages || 1, 1), 500);

    const initialQueue: string[] = [];
    if (sitemapUrl) {
      const urls = await parseSitemapUrls(sitemapUrl, normalisedDomain);
      initialQueue.push(...urls);
    } else {
      initialQueue.push(normalisedDomain);
    }

    // Vercel: no polite delay (would burn the ~10s Hobby limit); tighten HTTP timeout slightly.
    const onVercel = process.env.VERCEL === "1";

    const pages = await crawlSite({
      domain: normalisedDomain,
      sitemapUrl,
      maxPages: limitedMaxPages,
      startUrls: initialQueue,
      userAgent,
      followLinks: sitemapOnly ? false : true,
      delayMs: onVercel ? 0 : 250,
      requestTimeoutMs: onVercel ? 10000 : 15000
    });

    let results = analysePagesForOpportunities(pages, cleanedMappings);

    let gscByKeyword: Record<string, GscKeywordMetrics> | undefined;
    if (rawGsc && typeof rawGsc === "object") {
      const entries = Object.entries(rawGsc).slice(0, 8000);
      gscByKeyword = {};
      for (const [k, v] of entries) {
        if (!v || typeof v !== "object") continue;
        const im = Number((v as GscKeywordMetrics).impressions);
        const cl = Number((v as GscKeywordMetrics).clicks);
        if (!Number.isFinite(im) || !Number.isFinite(cl)) continue;
        const posRaw = (v as GscKeywordMetrics).position;
        const pos =
          posRaw !== undefined && Number.isFinite(Number(posRaw))
            ? Number(posRaw)
            : undefined;
        gscByKeyword[k.trim().toLowerCase()] = {
          impressions: Math.max(0, im),
          clicks: Math.max(0, cl),
          position: pos
        };
      }
      if (Object.keys(gscByKeyword).length === 0) gscByKeyword = undefined;
      else results = applyGscToResults(results, gscByKeyword);
    }

    const response: AnalyseResponseBody = {
      crawledPageCount: pages.length,
      totalKeywordMappingsAnalysed: cleanedMappings.length,
      totalOpportunitiesFound: results.filter(
        (r) =>
          r.status === "Opportunity found" || r.status === "Weak anchor"
      ).length,
      results
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Analyse API error", error);
    return NextResponse.json(
      { error: "Unexpected error during analysis." },
      { status: 500 }
    );
  }
}


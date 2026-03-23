import { NextRequest, NextResponse } from "next/server";
import type { AnalyseRequestBody, AnalyseResponseBody } from "@/types";
import { crawlSite } from "@/lib/crawler";
import { analysePagesForOpportunities } from "@/lib/analyser";
import { parseSitemapUrls } from "@/lib/sitemap";
import { normaliseUrl } from "@/lib/url";
import { applyGscToResults } from "@/lib/gsc-merge";
import { sanitizeGscByKeyword } from "@/lib/gsc-sanitize";
import { cleanKeywordMappings } from "@/lib/clean-mappings";

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

    const cleanedMappings = cleanKeywordMappings(keywordMappings);

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

    const gscByKeyword = sanitizeGscByKeyword(rawGsc);
    if (gscByKeyword) {
      results = applyGscToResults(results, gscByKeyword);
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
    const detail =
      error instanceof Error ? error.message : String(error);
    const safe = detail.replace(/\s+/g, " ").trim().slice(0, 400);
    return NextResponse.json(
      {
        error:
          safe && safe.length > 0
            ? `Analysis failed: ${safe}`
            : "Unexpected error during analysis."
      },
      { status: 500 }
    );
  }
}


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

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyseRequestBody;
    const {
      domain,
      sitemapUrl,
      maxPages = 100,
      keywordMappings,
      userAgent,
      sitemapOnly
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
        matchMode: m.matchMode || "phrase"
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

    const pages = await crawlSite({
      domain: normalisedDomain,
      sitemapUrl,
      maxPages: limitedMaxPages,
      startUrls: initialQueue,
      userAgent,
      followLinks: sitemapOnly ? false : true
    });

    const results = analysePagesForOpportunities(pages, cleanedMappings);

    const response: AnalyseResponseBody = {
      crawledPageCount: pages.length,
      totalKeywordMappingsAnalysed: cleanedMappings.length,
      totalOpportunitiesFound: results.filter(
        (r) => r.status === "Opportunity found"
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


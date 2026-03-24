import { NextRequest, NextResponse } from "next/server";
import type { AnalyseRequestBody } from "@/types";
import { cleanKeywordMappings } from "@/lib/clean-mappings";
import { normaliseUrl } from "@/lib/url";
import { runFullAnalyse } from "@/lib/run-full-analyse";

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
      keywordMappings,
      useWorkerQueue: _useWorkerQueue,
      ...rest
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

    const response = await runFullAnalyse({
      ...rest,
      domain,
      keywordMappings,
      cleanedMappings
    });

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


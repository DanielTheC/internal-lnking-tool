import { NextRequest, NextResponse } from "next/server";
import type { AnalyseRequestBody } from "@/types";
import { cleanKeywordMappings } from "@/lib/clean-mappings";
import { enqueueCrawlJob, getRedis } from "@/lib/crawl-queue-redis";

export async function POST(req: NextRequest) {
  if (!getRedis()) {
    return NextResponse.json(
      {
        error:
          "Redis queue is not configured. Set REDIS_URL on the Next.js server and run the crawl worker."
      },
      { status: 503 }
    );
  }

  const body = (await req.json()) as AnalyseRequestBody;
  const { useWorkerQueue: _u, ...rest } = body;

  if (!rest.domain || !rest.keywordMappings?.length) {
    return NextResponse.json(
      { error: "Domain and at least one keyword mapping are required." },
      { status: 400 }
    );
  }

  const cleanedMappings = cleanKeywordMappings(rest.keywordMappings);
  if (cleanedMappings.length === 0) {
    return NextResponse.json(
      { error: "At least one valid keyword mapping is required." },
      { status: 400 }
    );
  }

  const jobId = await enqueueCrawlJob({
    ...rest,
    keywordMappings: cleanedMappings
  });

  return NextResponse.json({ jobId });
}

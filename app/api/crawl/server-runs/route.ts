import { NextResponse } from "next/server";
import type { AnalyseResponseBody } from "@/types";
import { isCrawlServerSaveEnabled } from "@/lib/crawl-server-save-env";
import {
  appendServerRunFromResult,
  listServerRunsMeta
} from "@/lib/crawl-server-runs-store";
import type { SavedRunRecord } from "@/lib/run-history";

export async function GET() {
  if (!isCrawlServerSaveEnabled()) {
    return NextResponse.json(
      { error: "Server crawl save is not enabled (CRAWL_SERVER_SAVE_ENABLED)." },
      { status: 503 }
    );
  }
  const runs = await listServerRunsMeta();
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  if (!isCrawlServerSaveEnabled()) {
    return NextResponse.json(
      { error: "Server crawl save is not enabled." },
      { status: 503 }
    );
  }

  let body: {
    domain?: string;
    label?: string;
    settings?: SavedRunRecord["settings"];
    result?: AnalyseResponseBody;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const domain = body.domain?.trim();
  if (!domain || !body.result) {
    return NextResponse.json(
      { error: "Required: domain, result." },
      { status: 400 }
    );
  }

  try {
    const record = await appendServerRunFromResult({
      domain,
      label: body.label,
      settings: body.settings ?? {},
      result: body.result
    });
    if (!record) {
      return NextResponse.json(
        { error: "Could not save (disabled or invalid domain)." },
        { status: 503 }
      );
    }
    return NextResponse.json({
      id: record.id,
      createdAt: record.createdAt,
      domain: record.domain
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Save failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

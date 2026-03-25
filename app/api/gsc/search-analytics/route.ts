import { NextResponse } from "next/server";
import { isGscIntegrationConfigured } from "@/lib/gsc-env";
import { getGscConnectionById } from "@/lib/gsc-connections-store";
import { fetchGscQueryMetrics } from "@/lib/gsc-api";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  if (!isGscIntegrationConfigured()) {
    return NextResponse.json(
      { error: "GSC integration is not configured." },
      { status: 503 }
    );
  }

  let body: {
    connectionId?: string;
    siteUrl?: string;
    startDate?: string;
    endDate?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const connectionId = body.connectionId?.trim();
  const siteUrl = body.siteUrl?.trim();
  const startDate = body.startDate?.trim();
  const endDate = body.endDate?.trim();

  if (!connectionId || !siteUrl || !startDate || !endDate) {
    return NextResponse.json(
      {
        error:
          "Required: connectionId, siteUrl, startDate, endDate (YYYY-MM-DD)."
      },
      { status: 400 }
    );
  }
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return NextResponse.json(
      { error: "Dates must be YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const conn = await getGscConnectionById(connectionId);
  if (!conn) {
    return NextResponse.json({ error: "Unknown connection." }, { status: 404 });
  }

  try {
    const gscByKeyword = await fetchGscQueryMetrics({
      refreshToken: conn.refreshToken,
      siteUrl,
      startDate,
      endDate
    });
    return NextResponse.json({
      gscByKeyword,
      queryCount: Object.keys(gscByKeyword).length
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Search Analytics request failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { isGscIntegrationConfigured } from "@/lib/gsc-env";
import { getGscConnectionById } from "@/lib/gsc-connections-store";
import { listGscSites } from "@/lib/gsc-api";

export async function GET(request: Request) {
  if (!isGscIntegrationConfigured()) {
    return NextResponse.json(
      { error: "GSC integration is not configured." },
      { status: 503 }
    );
  }
  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId")?.trim();
  if (!connectionId) {
    return NextResponse.json(
      { error: "Missing connectionId query parameter." },
      { status: 400 }
    );
  }
  const conn = await getGscConnectionById(connectionId);
  if (!conn) {
    return NextResponse.json({ error: "Unknown connection." }, { status: 404 });
  }
  try {
    const sites = await listGscSites(conn.refreshToken);
    return NextResponse.json({ sites });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to list sites.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { isGscIntegrationConfigured } from "@/lib/gsc-env";
import { listGscConnectionsPublic } from "@/lib/gsc-connections-store";

export async function GET() {
  if (!isGscIntegrationConfigured()) {
    return NextResponse.json(
      { error: "GSC integration is not configured." },
      { status: 503 }
    );
  }
  const connections = await listGscConnectionsPublic();
  return NextResponse.json({ connections });
}

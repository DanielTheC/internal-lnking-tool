import { NextResponse } from "next/server";
import { isGscIntegrationConfigured } from "@/lib/gsc-env";

export async function GET() {
  return NextResponse.json({
    gscApiEnabled: isGscIntegrationConfigured()
  });
}

import { NextResponse } from "next/server";
import { isRedisConfigured } from "@/lib/crawl-queue-redis";
import { isIncrementalPersistenceAvailable } from "@/lib/crawl-incremental-cache";

export async function GET() {
  return NextResponse.json({
    queueEnabled: isRedisConfigured(),
    incrementalPersisted: isIncrementalPersistenceAvailable()
  });
}

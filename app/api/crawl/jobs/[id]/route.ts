import { NextResponse } from "next/server";
import { getCrawlJob } from "@/lib/crawl-queue-redis";

type RouteContext = { params: { id: string } };

export async function GET(_req: Request, context: RouteContext) {
  const id = context.params.id;
  if (!id) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }

  const job = await getCrawlJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}

import { NextResponse } from "next/server";
import { isCrawlServerSaveEnabled } from "@/lib/crawl-server-save-env";
import {
  deleteServerRun,
  getServerRun
} from "@/lib/crawl-server-runs-store";

type Ctx = { params: { id: string } };

export async function GET(_request: Request, context: Ctx) {
  if (!isCrawlServerSaveEnabled()) {
    return NextResponse.json({ error: "Server crawl save is not enabled." }, { status: 503 });
  }
  const run = await getServerRun(context.params.id);
  if (!run) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ run });
}

export async function DELETE(_request: Request, context: Ctx) {
  if (!isCrawlServerSaveEnabled()) {
    return NextResponse.json({ error: "Server crawl save is not enabled." }, { status: 503 });
  }
  const ok = await deleteServerRun(context.params.id);
  if (!ok) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { isGscIntegrationConfigured } from "@/lib/gsc-env";
import {
  deleteGscConnection,
  updateGscConnectionLabel
} from "@/lib/gsc-connections-store";

type Ctx = { params: { id: string } };

export async function DELETE(_request: Request, context: Ctx) {
  if (!isGscIntegrationConfigured()) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }
  const ok = await deleteGscConnection(context.params.id);
  if (!ok) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: Ctx) {
  if (!isGscIntegrationConfigured()) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }
  let body: { label?: string };
  try {
    body = (await request.json()) as { label?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const updated = await updateGscConnectionLabel(
    context.params.id,
    body.label
  );
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ connection: updated });
}

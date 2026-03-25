import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { isGscIntegrationConfigured } from "@/lib/gsc-env";
import { createGscOAuth2Client, GSC_OAUTH_SCOPES } from "@/lib/gsc-oauth";

function safeReturnPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600
};

export async function GET(request: Request) {
  if (!isGscIntegrationConfigured()) {
    return NextResponse.json(
      { error: "GSC integration is not configured on the server." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const returnTo = safeReturnPath(searchParams.get("return"));
  const label = searchParams.get("label")?.trim() || "";

  const state = randomBytes(24).toString("hex");
  const oauth2 = createGscOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GSC_OAUTH_SCOPES,
    state
  });

  const res = NextResponse.redirect(url);
  res.cookies.set("gsc_oauth_state", state, COOKIE_OPTS);
  res.cookies.set("gsc_oauth_return", returnTo, COOKIE_OPTS);
  if (label) {
    res.cookies.set("gsc_oauth_label", label.slice(0, 120), COOKIE_OPTS);
  } else {
    res.cookies.delete("gsc_oauth_label");
  }
  return res;
}

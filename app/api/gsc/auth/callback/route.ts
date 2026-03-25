import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { isGscIntegrationConfigured } from "@/lib/gsc-env";
import { addGscConnection } from "@/lib/gsc-connections-store";
import { createGscOAuth2Client } from "@/lib/gsc-oauth";
import { getPublicOrigin } from "@/lib/gsc-request-origin";

function safeReturnPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

export async function GET(request: Request) {
  const origin = getPublicOrigin(request);
  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/?gsc_error=${encodeURIComponent(code)}`, origin));

  if (!isGscIntegrationConfigured()) {
    return fail("not_configured");
  }

  const { searchParams } = new URL(request.url);
  const oauthErr = searchParams.get("error");
  if (oauthErr) {
    return fail(oauthErr);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = cookies();
  const expected = cookieStore.get("gsc_oauth_state")?.value;
  const returnTo = safeReturnPath(cookieStore.get("gsc_oauth_return")?.value);
  const labelCookie = cookieStore.get("gsc_oauth_label")?.value;

  if (!code || !state || !expected || state !== expected) {
    return fail("invalid_state");
  }

  const oauth2 = createGscOAuth2Client();
  let tokens;
  try {
    const t = await oauth2.getToken(code);
    tokens = t.tokens;
  } catch {
    return fail("token_exchange_failed");
  }

  if (!tokens.refresh_token) {
    return fail(
      "no_refresh_token_revoke_and_reconnect"
    );
  }

  oauth2.setCredentials(tokens);
  const oauth2User = google.oauth2({ version: "v2", auth: oauth2 });
  let email = "unknown@user";
  try {
    const { data } = await oauth2User.userinfo.get();
    if (data.email) email = data.email;
  } catch {
    // keep fallback email
  }

  await addGscConnection({
    email,
    refreshToken: tokens.refresh_token,
    label: labelCookie || undefined
  });

  const redirectUrl = new URL(returnTo, origin);
  redirectUrl.searchParams.set("gsc_connected", "1");

  const res = NextResponse.redirect(redirectUrl);
  res.cookies.delete("gsc_oauth_state");
  res.cookies.delete("gsc_oauth_return");
  res.cookies.delete("gsc_oauth_label");
  return res;
}

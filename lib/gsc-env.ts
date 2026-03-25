/**
 * Google Search Console OAuth + encrypted token storage require these env vars.
 * See README (Search Console API).
 */
export function isGscIntegrationConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.GSC_OAUTH_REDIRECT_URI?.trim() &&
      process.env.GSC_ENCRYPTION_SECRET?.trim()
  );
}

export function getGscRedirectUri(): string {
  const u = process.env.GSC_OAUTH_REDIRECT_URI?.trim();
  if (!u) throw new Error("GSC_OAUTH_REDIRECT_URI is not set");
  return u;
}

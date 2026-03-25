/**
 * Public URL for redirects (OAuth callback → app). Set in production.
 */
export function getPublicOrigin(request: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) {
    return env.replace(/\/$/, "");
  }
  return new URL(request.url).origin;
}

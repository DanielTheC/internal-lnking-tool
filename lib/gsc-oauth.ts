import { OAuth2Client } from "google-auth-library";

export const GSC_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/userinfo.email"
];

export function createGscOAuth2Client() {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirect = process.env.GSC_OAUTH_REDIRECT_URI?.trim();
  if (!id || !secret || !redirect) {
    throw new Error(
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GSC_OAUTH_REDIRECT_URI required"
    );
  }
  return new OAuth2Client(id, secret, redirect);
}

/**
 * Detect Cloudflare / bot-interstitial HTML (often returned with HTTP 200).
 */
export function isLikelyBotChallengePage(html: string): boolean {
  if (!html || html.length < 80) return false;
  const h = html.slice(0, 120_000);
  return (
    h.includes("cf-browser-verification") ||
    h.includes("cf_chl_opt") ||
    h.includes("__cf_chl_jschl_tk__") ||
    h.includes("cdn-cgi/challenge-platform") ||
    /Just a moment/i.test(h) && h.includes("Cloudflare") ||
    /Checking your browser before accessing/i.test(h) ||
    h.includes("Attention Required! | Cloudflare") ||
    h.includes("Enable JavaScript and cookies to continue")
  );
}

export class CrawlFatalError extends Error {
  readonly name = "CrawlFatalError";
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

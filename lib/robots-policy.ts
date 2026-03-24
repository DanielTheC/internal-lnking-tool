import axios from "axios";
import robotsParser from "robots-parser";

export type RobotsMatcher = ReturnType<typeof robotsParser>;

/**
 * Fetch /robots.txt for the crawl origin. 404 or fetch failure → no matcher (allow all),
 * matching common crawler behaviour when no rules are published.
 */
export async function fetchRobotsMatcher(
  startDomain: string,
  options: { userAgent: string; requestTimeoutMs: number }
): Promise<{ raw: string | null; robotsUrl: string; matcher: RobotsMatcher | null }> {
  const robotsUrl = new URL("/robots.txt", startDomain).toString();
  try {
    const res = await axios.get<string>(robotsUrl, {
      timeout: options.requestTimeoutMs,
      validateStatus: (s) => s === 200 || s === 404 || s === 410,
      headers: {
        "User-Agent": options.userAgent,
        Accept: "text/plain,*/*"
      }
    });
    if (res.status === 404 || res.status === 410) {
      return { raw: null, robotsUrl, matcher: null };
    }
    const raw = typeof res.data === "string" ? res.data : "";
    const matcher = robotsParser(robotsUrl, raw);
    return { raw, robotsUrl, matcher };
  } catch (e) {
    console.warn("robots.txt fetch failed; crawling without robots rules", {
      robotsUrl,
      error: e
    });
    return { raw: null, robotsUrl, matcher: null };
  }
}

export function matcherFromCachedRaw(
  robotsUrl: string,
  raw: string | null
): RobotsMatcher | null {
  if (raw === null) return null;
  return robotsParser(robotsUrl, raw);
}

/** If robots.txt says not allowed, return false. `undefined` from parser → treat as allowed. */
export function isUrlAllowedByRobots(
  matcher: RobotsMatcher | null,
  url: string,
  userAgent: string
): boolean {
  if (!matcher) return true;
  const allowed = matcher.isAllowed(url, userAgent);
  return allowed !== false;
}

/** Crawl-delay (seconds) in robots.txt; combined with base politeness delay. */
export function getEffectiveCrawlDelayMs(
  matcher: RobotsMatcher | null,
  userAgent: string,
  baseDelayMs: number
): number {
  if (!matcher) return baseDelayMs;
  const sec = matcher.getCrawlDelay(userAgent);
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return baseDelayMs;
  return Math.max(baseDelayMs, Math.round(sec * 1000));
}

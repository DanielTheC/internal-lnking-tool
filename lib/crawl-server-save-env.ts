/**
 * When enabled, successful crawls are appended to server-side storage
 * (Redis or `.data/crawl-server-runs.json`). See README.
 */
export function isCrawlServerSaveEnabled(): boolean {
  const v = process.env.CRAWL_SERVER_SAVE_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

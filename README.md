# Internal Linking Opportunity Finder

Next.js app that crawls a site, extracts on-page content, and scores internal linking opportunities from your keyword → destination URL mappings.

## Chunked crawling (Vercel / serverless)

Serverless functions have **short wall-clock limits**. Crawling many pages in one request can time out.

This project uses **chunked crawling** when the crawl limit is **greater than 15 pages**:

1. **`POST /api/crawl/batch`** — Fetches up to **`batchPageLimit`** new HTML pages (default **15**, range 5–40), updates a serialisable frontier (`queue` + `visited`), and returns `newPages`, `state`, and `complete`.
2. The **browser** loops until `complete` (or hits a safety cap of **400** batches), **merging** `PageData` in memory.
3. **Analysis + optional GSC weighting** run **in the browser** via `buildAnalyseResponse()` so:
   - Keyword mappings and GSC CSV data are **not** re-sent with every batch (smaller payloads).
   - No single server invocation has to crawl hundreds of pages.

For **≤15 pages**, the UI uses a single **`POST /api/analyse`** (full crawl + analysis on the server).

### Configuration

- **`vercel.json`** — `maxDuration: 300` for `app/api/analyse/route.ts` and `app/api/crawl/batch/route.ts` (requires a Vercel plan that allows long functions).
- **Vercel** — When `VERCEL=1`, crawl delay is **0** and HTTP timeout is **10s** per page (see `lib/crawler.ts` and batch route).

### Key files

| Area | File |
|------|------|
| Batch crawl logic | `lib/crawler.ts` (`runCrawlBatch`) |
| Batch API | `app/api/crawl/batch/route.ts` |
| Client loop + local analysis | `app/page.tsx`, `lib/build-analyse-response.ts` |
| Types | `types/index.ts` (`SerializableCrawlState`, batch request/response) |
| UI: pages per request | `components/CrawlForm.tsx` |

## Local development

```bash
npm install
npm run dev
```

```bash
npm run build
```

## Environment

- **`VERCEL`** — Set automatically on Vercel; affects crawl politeness and timeouts.

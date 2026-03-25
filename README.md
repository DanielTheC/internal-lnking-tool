# Internal Linking Opportunity Finder

Next.js app that crawls a site, extracts on-page content, and scores internal linking opportunities from your keyword → destination URL mappings.

- **UI**: `/` is the **Analyze** workspace (jump links: Analyze, Results). **`/how-it-works`** explains each feature in plain language.

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

## Incremental crawls (ETag / Last-Modified)

When **Incremental crawl** is enabled in the form (or `incremental: true` in the API body), the crawler:

1. Stores **validators** (`ETag`, `Last-Modified`) and a **snapshot of `PageData`** per normalised URL after a successful HTML fetch.
2. On later runs, sends **conditional GET** headers (`If-None-Match` / `If-Modified-Since`) when validators exist.
3. On **`304 Not Modified`**, reuses the cached `PageData` (no HTML body) and still **discovers outgoing internal links** from the snapshot so the frontier stays consistent.

**Persistence**

| Environment | Behaviour |
|-------------|-----------|
| **`REDIS_URL` set** | Cache is stored in Redis (`ilo:crawl:incr:<origin>`), 30-day TTL. Recommended for **chunked** `/api/crawl/batch` and production. |
| **Local dev** (no Redis) | Writes under **`.cache/crawl-incremental/`** (gitignored). |
| **Production without Redis** | Cross-run persistence is **off**; incremental only helps within a single long request. Set `CRAWL_INCREMENTAL_FILE=1` to force file writes in production (ensure a writable path). |

`GET /api/crawl/config` includes **`incrementalPersisted`** so the UI can warn when persistence is unavailable.

## Run history & exports (browser)

- **Export CSV / Export JSON** on the results table download the **current** view (CSV respects filters; JSON is the full `AnalyseResponseBody`, including `graph` when present).
- **Run history** (`/run-history`) and **Topical map** (`/topical-map`) are linked in the app header. History uses browser **localStorage**; the topical map reads the graph from your **most recent successful analysis** in this session (see `lib/last-result-session.ts`).

Use exports for backups or sharing.

## Server-side crawl archive (optional)

Set **`CRAWL_SERVER_SAVE_ENABLED=1`** (or `true`) so each successful crawl is stored on the server as a full **`SavedRunRecord`** (same shape as browser run history: domain, settings, full `AnalyseResponseBody`, etc.). Up to **40** runs are kept; older runs are dropped when the JSON blob exceeds the same size guard as browser history.

| Storage | Location |
|---------|----------|
| **`REDIS_URL` set** | Redis key `ilo:crawl-server-runs:blob:v1` (recommended on Vercel / multi-instance). |
| **No Redis** | File **`.data/crawl-server-runs.json`** (local dev; ensure the directory is writable). |

**Where saving happens**

- **`POST /api/analyse`** (≤15 pages, single request): saved in the route handler after analysis.
- **Chunked crawl** (browser loops `/api/crawl/batch` then analyses locally): the browser **`POST`s** `/api/crawl/server-runs` after a successful run.
- **Redis queue worker** (`npm run crawl-worker`): saved when the job completes.

`GET /api/crawl/config` exposes **`serverCrawlSaveEnabled`**. List runs without full JSON: **`GET /api/crawl/server-runs`**. Full run: **`GET /api/crawl/server-runs/:id`**. Remove: **`DELETE /api/crawl/server-runs/:id`**.

There is **no authentication** on these APIs by default—only enable this on trusted networks or add your own protection (VPN, middleware, secret header) before exposing the app publicly.

## Search Console API (optional automatic query import)

Instead of uploading the **Performance → Queries** CSV, you can connect one or more **Google accounts** (e.g. two agency accounts) and pull the same metrics with the **Search Analytics API**.

### Google Cloud setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Search Console API**.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. Add **Authorized redirect URIs** exactly matching your app, e.g.  
   `http://localhost:3000/api/gsc/auth/callback` (dev) and  
   `https://your-domain.com/api/gsc/auth/callback` (prod).

### Environment variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret |
| `GSC_OAUTH_REDIRECT_URI` | Must match one authorized redirect URI **exactly** (e.g. `http://localhost:3000/api/gsc/auth/callback`) |
| `GSC_ENCRYPTION_SECRET` | Long random string used to encrypt refresh tokens at rest (scrypt-derived AES-256-GCM key) |
| `NEXT_PUBLIC_APP_URL` | Optional; public origin for redirects after OAuth (e.g. `https://your-domain.com`). If unset, the request URL origin is used. |

### Token storage

- **`REDIS_URL` set** (recommended for Vercel / multiple instances): encrypted connection blob in Redis (`ilo:gsc:connections:blob:v1`).
- **Local / no Redis**: encrypted file under **`.data/gsc-connections.enc`** (gitignored).

Each **Connect Google** run adds a connection (refresh token). In the UI, pick **which Google account** and **which Search Console property** for each client; **Account display label** + **Save label** rename a connection without reconnecting. **Saved client presets** (browser `localStorage`) remember `connection + property` pairs for quick switching.

Copy **`.env.example`** to **`.env.local`** and fill in the GSC variables when using the API.

## Local development

```bash
npm install
npm run dev
```

```bash
npm run build
```

## Redis crawl queue + worker (large sites)

The in-browser loop calls `/api/crawl/batch` up to **400** times. For very large crawls, use a **background worker** instead: one long Node process runs `crawlSite` to completion (no batch cap).

### 1. Redis

Set **`REDIS_URL`** on the machine running **Next.js** (e.g. `redis://127.0.0.1:6379`).

Local Redis:

```bash
docker compose up -d
```

### 2. Worker process

In a **second terminal** (same repo, same `REDIS_URL`):

```bash
set REDIS_URL=redis://127.0.0.1:6379
npm run crawl-worker
```

### 3. App UI

When `REDIS_URL` is set, the app exposes **`GET /api/crawl/config`** → `{ "queueEnabled": true }` and the form shows **“Redis background worker”**. Enable it and run an analysis: the browser **enqueues a job** and **polls** `GET /api/crawl/jobs/:id` until `complete` or `failed`.

### API

| Method | Path | Purpose |
|--------|------|--------|
| `GET` | `/api/crawl/config` | `queueEnabled`, `incrementalPersisted` |
| `POST` | `/api/crawl/jobs` | Enqueue a crawl (same JSON body as analyse, minus UI-only fields) |
| `GET` | `/api/crawl/jobs/:id` | Job status, progress, `result` when done |

### Deployment notes

- **Vercel** — Keep using **chunked browser crawls** or **single `/api/analyse`**; the worker is **not** meant to run on Vercel serverless. Run the worker on a **VM, Docker host, Railway, Render worker**, etc., with the same `REDIS_URL` as your API if the API enqueues jobs.
- **Job durability** — If the worker dies mid-job, that job is lost (no re-queue in v1). Restart the worker and submit again.
- **Result size** — Large `result` JSON is stored in Redis (fine for typical sites; huge results may need a different store later).

## Environment

- **`VERCEL`** — Set automatically on Vercel; affects crawl politeness and timeouts.
- **`REDIS_URL`** — Enables the crawl queue + worker (optional).

## robots.txt

The crawler loads `https://<your-domain>/robots.txt` once per crawl (cached in chunked crawl state so later batches don’t re-fetch it).

- **Disallow / Allow** — URLs that are disallowed for your crawl User-Agent are **not queued** and **not fetched.
- **Crawl-delay** — If present for your User-Agent, the delay between requests is **at least** `max(crawl-delay seconds, your existing politeness delay)` (e.g. Vercel still uses 0 ms base delay unless the site sets Crawl-delay).
- **404 / unreachable robots.txt** — Treated as **no rules** (everything allowed), which matches common crawler behaviour.

## Paragraph context (scoring)

Keyword matches are analysed **per `<p>` block** (fallback: whole main text if there are no `<p>` tags). Each block gets a **context quality** score (0–1) based on:

- Multiple sentences, reasonable length → higher (editorial body copy).
- Short blurbs, cookie/newsletter/privacy boilerplate → lower.

That score **adds up to +3** to the opportunity score and appears as the **Context** column. Snippets prefer the **highest-quality paragraph** that contains the keyword.

## Path prefixes (crawl only certain folders)

In the form, **Path prefixes** lets you list URL paths such as `/blog`, `/sale/mens`. Only pages whose path **starts with** one of these prefixes are **queued and fetched**. Link discovery follows the same rules.

- **Empty** = crawl the whole site (default).
- **`/`** = explicitly allow the entire site (useful with sitemaps).
- With a **sitemap**, URLs are filtered to these prefixes. If nothing matches, the crawl seeds from `https://your-domain` + each prefix (e.g. `/blog` → `https://example.com/blog`).

## Why some sites won’t crawl (e.g. Cloudflare)

Many shops use **Cloudflare** (or similar). They often:

- **Block or challenge** requests from **datacenter IPs** (including **Vercel** / AWS Lambda).
- Show a **“Just a moment…”** / JavaScript check — this app **does not execute JavaScript**, so that page cannot be “passed” like a real browser.

**What to try**

1. Run **`npm run dev` on your own PC** — your home/office IP is often allowed.
2. Turn on **“Use sitemap URLs only”** and keep the crawl limit small (only URLs listed in the sitemap are fetched).
3. Try another **User-Agent** preset (rarely fixes Cloudflare, but sometimes helps).
4. For production on Vercel, there is **no guaranteed fix** without a **proxy with residential IPs** or the site **allowlisting** your crawler — that’s a limitation of serverless crawling, not this repo only.

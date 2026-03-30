import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works | Internal Linking Opportunity Finder",
  description:
    "How crawling, analysis, scoring, and related features work in this app."
};

const toc = [
  { id: "overview", label: "Overview" },
  { id: "crawling", label: "Crawling" },
  { id: "mappings", label: "Keyword mappings" },
  { id: "content", label: "Page content & links" },
  { id: "results", label: "Results & statuses" },
  { id: "scoring", label: "Scoring & GSC" },
  { id: "incremental", label: "Incremental crawl" },
  { id: "worker", label: "Background worker (Redis)" },
  { id: "history", label: "Run history & compare" },
  { id: "map", label: "Topical map" },
  { id: "exports", label: "Exports" },
  { id: "privacy", label: "Data & limits" }
];

export default function HowItWorksPage() {
  return (
    <div className="space-y-10 pb-16">
      <header className="space-y-2 border-b border-slate-800 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">
          How it works
        </h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Plain-language rules for each part of the app. The{" "}
          <strong>Analyze</strong> workspace is the main crawl form and results
          table. <strong>Run history</strong>, <strong>Topical map</strong>, and
          this page are linked from the header. Optional features (Search Console
          API pull, server-side run archive) need environment variables—see the
          README.
        </p>
        <p className="text-sm">
          <Link href="/" className="text-blue-400 hover:underline">
            ← Back to Analyze
          </Link>
        </p>
      </header>

      <nav
        aria-label="Table of contents"
        className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Contents
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
          {toc.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="text-blue-400 hover:text-blue-300 hover:underline"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <section id="overview" className="scroll-mt-28 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Overview</h2>
        <p className="text-sm leading-relaxed text-slate-300">
          You give a <strong>domain</strong> and one or more{" "}
          <strong>keyword → destination URL</strong> mappings. The app crawls
          pages (respecting limits and robots), extracts main content, and
          scores each mapping per page to surface internal linking
          opportunities.
        </p>
      </section>

      <section id="crawling" className="scroll-mt-28 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Crawling</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>
            <strong>robots.txt</strong> is loaded for the origin once per crawl
            (cached in chunked mode). Disallowed URLs are not queued or fetched.
            Crawl-delay, if present, increases delay between requests.
          </li>
          <li>
            <strong>Max pages</strong> is capped (e.g. 500). HTML-only; non-HTML
            responses are skipped.
          </li>
          <li>
            <strong>Sitemap</strong> (optional) seeds URLs; you can restrict paths
            with <strong>path prefixes</strong> so only certain folders are
            crawled.
          </li>
          <li>
            <strong>Sitemap only</strong> follows links from sitemap seeds only
            (no link discovery from page bodies).
          </li>
          <li>
            <strong>≤15 pages</strong>: one server call <code className="text-slate-400">POST /api/analyse</code> runs crawl + analysis on the server.
          </li>
          <li>
            <strong>&gt;15 pages</strong>: the browser loops{" "}
            <code className="text-slate-400">POST /api/crawl/batch</code> until
            the crawl finishes or a safety cap (~400 batch steps). Analysis runs
            in the browser after all pages are collected.
          </li>
          <li>
            On Vercel, crawl delay may be reduced and HTTP timeouts shortened to
            fit serverless limits.
          </li>
        </ul>
      </section>

      <section id="mappings" className="scroll-mt-28 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">
          Keyword mappings
        </h2>
        <p className="text-sm text-slate-300">
          Each row is a <strong>keyword</strong> (or phrase), a{" "}
          <strong>destination URL</strong> you want to promote, and a{" "}
          <strong>match mode</strong> (exact vs phrase). The analyser searches
          stripped <strong>body text</strong> and <strong>in-body anchors</strong>{" "}
          (after removing chrome described below). When a page has real{" "}
          <code className="text-slate-400">&lt;p&gt;</code> blocks, a hit usually
          needs to appear in paragraph copy that passes an editorial-quality
          check—matches only in thin UI blobs (e.g. long “Refine by…” lists) tend
          to be treated as <strong>Keyword not found</strong>.
        </p>
      </section>

      <section id="content" className="scroll-mt-28 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">
          Page content & links
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>
            Extraction starts from <code className="text-slate-400">main</code>,{" "}
            <code className="text-slate-400">article</code>, or{" "}
            <code className="text-slate-400">body</code>.{" "}
            <code className="text-slate-400">header</code>,{" "}
            <code className="text-slate-400">footer</code>,{" "}
            <code className="text-slate-400">nav</code>, and{" "}
            <code className="text-slate-400">aside</code> are removed, then
            typical <strong>facet / filter</strong> regions and{" "}
            <strong>breadcrumb</strong> blocks inside the remainder—so
            “breadcrumb link only” text does not drive keyword hits.
          </li>
          <li>
            <strong>Crawl discovery</strong> still collects every internal{" "}
            <code className="text-slate-400">href</code> in that main tree{" "}
            <em>before</em> those strips, so category URLs from crumbs or filters
            are not skipped when building the crawl queue.
          </li>
          <li>
            <strong>“Strong link” / “Weak anchor” / “Linked to different URL”</strong>{" "}
            use anchors that remain <em>after</em> the same strip. A link that
            exists only in a removed breadcrumb or facet bar does{" "}
            <strong>not</strong> count as the page already linking in the body—
            you can still get an <strong>Opportunity found</strong> if the
            keyword appears in real copy and body context passes the checks.
          </li>
        </ul>
      </section>

      <section id="results" className="scroll-mt-28 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">
          Results & statuses
        </h2>
        <p className="text-sm text-slate-300">
          Each row is a combination of keyword, source page, and destination.
          Statuses include: opportunity found, strong link, weak anchor, keyword
          not found, linked to a different URL, source equals destination, etc.
          Snippets aim to show <strong>body</strong> context, not removed chrome.
          See the results table for the exact label on each row.
        </p>
      </section>

      <section id="scoring" className="scroll-mt-28 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Scoring & GSC</h2>
        <p className="text-sm text-slate-300">
          Rows get a numeric <strong>score</strong> derived from match
          strength, anchor context, and (when enabled) paragraph-level context
          quality. If you import <strong>Search Console Performance → Queries</strong>{" "}
          (CSV) or pull the same data via the <strong>Search Console API</strong>{" "}
          (when the server is configured), queries matching keywords can boost
          scores using impressions/clicks.
        </p>
      </section>

      <section id="incremental" className="scroll-mt-28 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">
          Incremental crawl
        </h2>
        <p className="text-sm text-slate-300">
          When enabled, the crawler stores <strong>ETag</strong> /{" "}
          <strong>Last-Modified</strong> and page snapshots. On later runs it
          may receive <strong>304 Not Modified</strong> and reuse cached content
          without downloading HTML again. Persistence requires{" "}
          <strong>Redis</strong> (recommended for chunked crawls) or local
          cache in development; without it, incremental behaviour is limited.
        </p>
      </section>

      <section id="worker" className="scroll-mt-28 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">
          Background worker (Redis)
        </h2>
        <p className="text-sm text-slate-300">
          With <code className="text-slate-400">REDIS_URL</code> and a separate{" "}
          <strong>crawl worker</strong> process, you can queue a full analysis
          instead of many browser batch calls—useful for very large crawls. The
          worker is not a Vercel serverless function; run it on a long-lived
          host with the same Redis URL as the app.
        </p>
      </section>

      <section id="history" className="scroll-mt-28 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">
          Run history & compare
        </h2>
        <p className="text-sm text-slate-300">
          By default, completed runs are saved in <strong>browser localStorage</strong>.{" "}
          Open <strong>Run history</strong> from the header to load past results or
          compare two saved runs. If the host enables{" "}
          <code className="text-slate-400">CRAWL_SERVER_SAVE_ENABLED</code>{" "}
          (see README), successful analyses can also be archived on the server
          (Redis or disk). Use <strong>CSV / JSON export</strong> from the results
          table to keep snapshots under your own control.
        </p>
      </section>

      <section id="map" className="scroll-mt-28 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Topical map</h2>
        <p className="text-sm text-slate-300">
          Analysis responses include a <strong>graph</strong> payload (nodes and
          edges). Open <strong>Topical map</strong> from the header after a
          successful analysis (it uses the latest result in this browser
          session), or <strong>Export JSON</strong> from the results table for a
          full offline copy.
        </p>
      </section>

      <section id="exports" className="scroll-mt-28 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Exports</h2>
        <p className="text-sm text-slate-300">
          <strong>CSV</strong> exports the filtered table view.{" "}
          <strong>JSON</strong> exports the full analysis payload for the current
          result (including graph when present).
        </p>
      </section>

      <section id="privacy" className="scroll-mt-28 space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Data & limits</h2>
        <p className="text-sm text-slate-300">
          Presets and client-side run history live only in this browser unless you
          export or copy them. Clearing site data removes them. If you use{" "}
          <strong>Search Console API</strong> sign-in, refresh tokens are stored
          on the server (encrypted) when that integration is configured. Crawling
          third-party sites should follow their terms and robots rules; this tool
          is intended for sites you are allowed to crawl.
        </p>
      </section>
    </div>
  );
}

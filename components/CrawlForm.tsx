"use client";

import { useState } from "react";
import type { AnalyseRequestBody, KeywordMapping } from "@/types";
import KeywordMappingInput from "@/components/KeywordMappingInput";
import { parseGscCsvToKeywordMap } from "@/lib/gsc-csv";
import {
  USER_AGENT_PRESETS,
  USER_AGENT_PRESET_CUSTOM,
  resolveUserAgentForPreset
} from "@/lib/user-agent-presets";
import { parsePathPrefixesField } from "@/lib/path-prefixes";

type Props = {
  onAnalyse: (payload: AnalyseRequestBody) => void;
  isLoading: boolean;
  crawlProgress?: string | null;
  /** Server has REDIS_URL — enables background worker option. */
  queueEnabled?: boolean;
  /** Incremental cache can be persisted (Redis or local .cache in dev). */
  incrementalPersisted?: boolean;
};

export default function CrawlForm({
  onAnalyse,
  isLoading,
  crawlProgress,
  queueEnabled = false,
  incrementalPersisted = false
}: Props) {
  const [domain, setDomain] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [maxPages, setMaxPages] = useState<number | "">(50);
  const [keywordMappings, setKeywordMappings] = useState<KeywordMapping[]>([
    { keyword: "", destinationUrl: "", matchMode: "phrase" }
  ]);
  const [userAgentPresetId, setUserAgentPresetId] = useState("default");
  const [customUserAgent, setCustomUserAgent] = useState("");
  const [sitemapOnly, setSitemapOnly] = useState(false);
  const [gscByKeyword, setGscByKeyword] = useState<
    Record<
      string,
      { impressions: number; clicks: number; position?: number }
    >
  >({});
  const [gscFileLabel, setGscFileLabel] = useState<string | null>(null);
  const [gscParseError, setGscParseError] = useState<string | null>(null);
  const [batchPageLimit, setBatchPageLimit] = useState(15);
  const [pathPrefixesText, setPathPrefixesText] = useState("");
  const [useWorkerQueue, setUseWorkerQueue] = useState(false);
  const [incremental, setIncremental] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pathPrefixes = parsePathPrefixesField(pathPrefixesText);
    onAnalyse({
      domain,
      sitemapUrl: sitemapUrl || undefined,
      maxPages: typeof maxPages === "number" ? maxPages : undefined,
      keywordMappings,
      userAgent: resolveUserAgentForPreset(
        userAgentPresetId,
        customUserAgent
      ),
      sitemapOnly,
      gscByKeyword:
        Object.keys(gscByKeyword).length > 0 ? gscByKeyword : undefined,
      batchPageLimit,
      allowedPathPrefixes:
        pathPrefixes.length > 0 ? pathPrefixes : undefined,
      useWorkerQueue: queueEnabled && useWorkerQueue,
      incremental
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-900/40"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-slate-200">
            Domain
          </label>
          <input
            type="url"
            required
            placeholder="https://www.example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-slate-200">
            Sitemap URL (optional)
          </label>
          <input
            type="url"
            placeholder="https://www.example.com/sitemap.xml"
            value={sitemapUrl}
            onChange={(e) => setSitemapUrl(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-slate-200">
            Crawl limit
          </label>
          <input
            type="number"
            min={1}
            max={500}
            value={maxPages}
            onChange={(e) =>
              setMaxPages(e.target.value ? Number(e.target.value) : "")
            }
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-slate-400">
            Max 500. Crawls with <span className="text-slate-300">more than 15 pages</span>{" "}
            use <strong>chunked requests</strong> so each call stays within
            serverless time limits (recommended on Vercel Hobby).
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-slate-200">
            Pages per request (chunked crawl)
          </label>
          <input
            type="number"
            min={5}
            max={40}
            value={batchPageLimit}
            onChange={(e) =>
              setBatchPageLimit(
                Math.min(40, Math.max(5, Number(e.target.value) || 15))
              )
            }
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-slate-400">
            Lower if batches time out; higher = fewer round trips (Pro only helps
            per-request ceiling).
          </p>
        </div>
      </div>

      {queueEnabled && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={useWorkerQueue}
              onChange={(e) => setUseWorkerQueue(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              <span className="font-semibold text-emerald-200">
                Redis background worker
              </span>
              <span className="block text-xs text-slate-400">
                Runs the crawl on a long-lived worker process (no 400-step browser
                limit, better for large sites). Requires{" "}
                <code className="text-slate-300">REDIS_URL</code> and{" "}
                <code className="text-slate-300">npm run crawl-worker</code>{" "}
                running separately.
              </span>
            </span>
          </label>
        </div>
      )}

      <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 px-4 py-3">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={incremental}
            onChange={(e) => setIncremental(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-600 focus:ring-sky-500"
          />
          <span>
            <span className="font-semibold text-sky-200">
              Incremental crawl (ETag / Last-Modified)
            </span>
            <span className="block text-xs text-slate-400">
              Sends conditional GETs and reuses cached page snapshots on{" "}
              <code className="text-slate-300">304 Not Modified</code>. Persists per
              domain in{" "}
              <code className="text-slate-300">REDIS_URL</code> (recommended) or{" "}
              <code className="text-slate-300">.cache/crawl-incremental/</code> in local
              dev.
              {!incrementalPersisted && (
                <span className="mt-1 block text-amber-400/95">
                  No cache persistence on this server — incremental only applies within
                  one run (set <code className="text-slate-300">REDIS_URL</code> or use
                  local dev for cross-run reuse).
                </span>
              )}
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <label className="block text-sm font-medium text-slate-200">
          Path prefixes (optional — limit crawl to folders)
        </label>
        <textarea
          value={pathPrefixesText}
          onChange={(e) => setPathPrefixesText(e.target.value)}
          rows={3}
          placeholder={"/blog\n/sale\n/mens-boots"}
          className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-2 text-xs text-slate-400">
          One path per line or comma-separated. Only URLs whose path starts with one of these
          prefixes are fetched and followed (e.g. <code className="text-slate-300">/blog</code>{" "}
          matches <code className="text-slate-300">/blog</code> and{" "}
          <code className="text-slate-300">/blog/post-slug</code>). Leave empty to crawl the
          whole site. Use <code className="text-slate-300">/</code> alone for full site when
          you also use a sitemap. With a sitemap, URLs are filtered to these prefixes; if none
          match, the crawl starts from <code className="text-slate-300">https://your-domain…/prefix</code>{" "}
          for each prefix.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            User-Agent
          </label>
          <select
            value={userAgentPresetId}
            onChange={(e) => setUserAgentPresetId(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {USER_AGENT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {userAgentPresetId === USER_AGENT_PRESET_CUSTOM && (
            <div>
              <label className="sr-only" htmlFor="custom-user-agent">
                Custom User-Agent string
              </label>
              <input
                id="custom-user-agent"
                type="text"
                placeholder="Paste a full User-Agent string"
                value={customUserAgent}
                onChange={(e) => setCustomUserAgent(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
          <p className="text-xs text-slate-400">
            Some sites treat crawlers differently; try another preset if requests fail.
          </p>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={sitemapOnly}
              onChange={(e) => setSitemapOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-blue-500"
            />
            <span>Use sitemap URLs only</span>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Search Console (optional)
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Export <strong>Performance → Queries</strong> as CSV from GSC
              and upload. Rows are matched to your <strong>keyword</strong>{" "}
              (case-insensitive) to boost sorting scores.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-slate-500">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setGscParseError(null);
                  try {
                    const text = await file.text();
                    const map = parseGscCsvToKeywordMap(text);
                    setGscByKeyword(map);
                    setGscFileLabel(
                      `${file.name} · ${Object.keys(map).length} queries`
                    );
                  } catch (err) {
                    setGscByKeyword({});
                    setGscFileLabel(null);
                    setGscParseError(
                      err instanceof Error ? err.message : "Invalid CSV"
                    );
                  }
                }}
              />
              Choose CSV
            </label>
            {gscFileLabel && (
              <button
                type="button"
                onClick={() => {
                  setGscByKeyword({});
                  setGscFileLabel(null);
                  setGscParseError(null);
                }}
                className="text-xs text-slate-400 hover:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {gscFileLabel && (
          <p className="mt-2 text-xs text-emerald-400">{gscFileLabel}</p>
        )}
        {gscParseError && (
          <p className="mt-2 text-xs text-red-400">{gscParseError}</p>
        )}
      </div>

      <KeywordMappingInput
        mappings={keywordMappings}
        onChange={setKeywordMappings}
      />

      {crawlProgress && (
        <p className="rounded-md border border-blue-500/30 bg-blue-950/40 px-3 py-2 text-sm text-blue-100">
          {crawlProgress}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-600/40 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-600"
        >
          {isLoading ? "Analysing…" : "Analyse internal links"}
        </button>
        <p className="text-xs text-slate-400">
          The crawl runs in-memory only. No data is stored.
        </p>
      </div>
    </form>
  );
}


"use client";

import { useState } from "react";
import type { KeywordMapping } from "@/types";
import KeywordMappingInput from "@/components/KeywordMappingInput";

type Props = {
  onAnalyse: (payload: {
    domain: string;
    sitemapUrl?: string;
    maxPages?: number;
    keywordMappings: KeywordMapping[];
    userAgent?: string;
    sitemapOnly?: boolean;
  }) => void;
  isLoading: boolean;
};

export default function CrawlForm({ onAnalyse, isLoading }: Props) {
  const [domain, setDomain] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [maxPages, setMaxPages] = useState<number | "">(50);
  const [keywordMappings, setKeywordMappings] = useState<KeywordMapping[]>([
    { keyword: "", destinationUrl: "", matchMode: "phrase" }
  ]);
  const [userAgent, setUserAgent] = useState("");
  const [sitemapOnly, setSitemapOnly] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAnalyse({
      domain,
      sitemapUrl: sitemapUrl || undefined,
      maxPages: typeof maxPages === "number" ? maxPages : undefined,
      keywordMappings,
      userAgent: userAgent || undefined,
      sitemapOnly
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
            Limits total pages crawled (max 500).
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-200">
            User-Agent (optional)
          </label>
          <input
            type="text"
            placeholder="Leave blank to use default browser-like User-Agent"
            value={userAgent}
            onChange={(e) => setUserAgent(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
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

      <KeywordMappingInput
        mappings={keywordMappings}
        onChange={setKeywordMappings}
      />

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


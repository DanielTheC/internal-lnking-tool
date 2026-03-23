"use client";

import { useEffect, useState } from "react";
import CrawlForm from "@/components/CrawlForm";
import ResultsTable from "@/components/ResultsTable";
import type {
  AnalyseResponseBody,
  AnalyseRequestBody,
  CrawlBatchResponseBody,
  PageData,
  SerializableCrawlState
} from "@/types";
import { buildAnalyseResponse } from "@/lib/build-analyse-response";
import { cleanKeywordMappings } from "@/lib/clean-mappings";
import { parseFailedFetchResponse } from "@/lib/parse-fetch-error";

type Preset = {
  name: string;
  payload: AnalyseRequestBody;
};

export default function HomePage() {
  const [data, setData] = useState<AnalyseResponseBody | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<AnalyseRequestBody | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [crawlProgress, setCrawlProgress] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("ilo-presets");
      if (raw) {
        const parsed = JSON.parse(raw) as Preset[];
        setPresets(parsed);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const persistPresets = (next: Preset[]) => {
    setPresets(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ilo-presets", JSON.stringify(next));
    }
  };

  const handleAnalyse = async (payload: AnalyseRequestBody) => {
    setIsLoading(true);
    setError(null);
    setData(null);
    setCrawlProgress(null);
    setLastPayload(payload);
    try {
      const cleanedMappings = cleanKeywordMappings(payload.keywordMappings);
      if (cleanedMappings.length === 0) {
        throw new Error(
          "Add at least one keyword mapping with keyword and destination URL."
        );
      }

      const maxPages = Math.min(
        Math.max(payload.maxPages ?? 50, 1),
        500
      );
      /** Above this, use /api/crawl/batch loops so each server call stays short (Vercel Hobby ~10s). */
      const useChunked = maxPages > 15;

      if (!useChunked) {
        const res = await fetch("/api/analyse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            keywordMappings: cleanedMappings
          })
        });
        if (!res.ok) {
          throw new Error(await parseFailedFetchResponse(res));
        }
        const json = (await res.json()) as AnalyseResponseBody;
        setData(json);
        return;
      }

      const allPages: PageData[] = [];
      let state: SerializableCrawlState | null = null;
      let complete = false;
      let batchN = 0;
      const batchLimit = Math.min(
        Math.max(payload.batchPageLimit ?? 15, 5),
        40
      );

      while (!complete && batchN < 400) {
        setCrawlProgress(
          `Crawling… step ${batchN + 1} · ${allPages.length} pages collected (target ≤ ${maxPages})`
        );
        const res = await fetch("/api/crawl/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain: payload.domain,
            sitemapUrl: payload.sitemapUrl,
            maxPages,
            userAgent: payload.userAgent,
            sitemapOnly: payload.sitemapOnly,
            alreadyCollected: allPages.length,
            batchPageLimit: batchLimit,
            state
          })
        });
        if (!res.ok) {
          throw new Error(await parseFailedFetchResponse(res));
        }
        const json = (await res.json()) as CrawlBatchResponseBody;
        allPages.push(...json.newPages);
        state = json.state;
        complete = json.complete;
        batchN++;
      }

      if (!complete) {
        throw new Error(
          "Crawl did not finish within the safety limit (400 batch steps). Try a smaller crawl limit, fewer sitemap URLs, or adjust pages per request."
        );
      }

      setCrawlProgress(
        `Analysing ${allPages.length} pages…`
      );
      const out = buildAnalyseResponse({
        pages: allPages,
        keywordMappings: cleanedMappings,
        gscByKeyword: payload.gscByKeyword
      });
      setData(out);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setIsLoading(false);
      setCrawlProgress(null);
    }
  };

  return (
    <main className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
          Internal Linking Opportunity Finder
        </h1>
        <p className="max-w-2xl text-sm text-slate-300">
          Crawl your site, analyse on-page content and discover{" "}
          <span className="font-semibold text-emerald-300">
            missed internal linking opportunities
          </span>{" "}
          based on your target keyword-to-URL mappings.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
          <span className="font-semibold text-slate-100">Presets</span>
          <select
            value=""
            onChange={(e) => {
              const selected = presets.find((p) => p.name === e.target.value);
              if (selected) {
                handleAnalyse(selected.payload);
              }
            }}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Load preset…</option>
            {presets.map((preset) => (
              <option key={preset.name} value={preset.name}>
                {preset.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Preset name"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            className="w-40 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            disabled={!presetName || !lastPayload}
            onClick={() => {
              if (!presetName || !lastPayload) return;
              const { gscByKeyword: _g, ...payloadWithoutGsc } = lastPayload;
              const next = [
                ...presets.filter((p) => p.name !== presetName),
                { name: presetName, payload: payloadWithoutGsc }
              ];
              persistPresets(next);
            }}
            className="inline-flex items-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-100 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save current as preset
          </button>
        </div>
      </header>

      <CrawlForm
        onAnalyse={handleAnalyse}
        isLoading={isLoading}
        crawlProgress={crawlProgress}
      />

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <ResultsTable data={data} />
    </main>
  );
}


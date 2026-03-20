"use client";

import { useEffect, useState } from "react";
import CrawlForm from "@/components/CrawlForm";
import ResultsTable from "@/components/ResultsTable";
import type { AnalyseResponseBody, AnalyseRequestBody } from "@/types";

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
    setLastPayload(payload);
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to analyse site");
      }
      const json = (await res.json()) as AnalyseResponseBody;
      setData(json);
    } catch (e: any) {
      setError(e.message || "Unexpected error");
    } finally {
      setIsLoading(false);
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
              const next = [
                ...presets.filter((p) => p.name !== presetName),
                { name: presetName, payload: lastPayload }
              ];
              persistPresets(next);
            }}
            className="inline-flex items-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-100 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save current as preset
          </button>
        </div>
      </header>

      <CrawlForm onAnalyse={handleAnalyse} isLoading={isLoading} />

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <ResultsTable data={data} />
    </main>
  );
}


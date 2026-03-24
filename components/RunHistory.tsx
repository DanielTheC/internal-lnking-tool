"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyseResponseBody } from "@/types";
import {
  compareRuns,
  deleteRun,
  loadRunHistory,
  MAX_SAVED_RUNS,
  type SavedRunRecord,
  type RunComparisonSummary
} from "@/lib/run-history";

type Props = {
  /** Refresh token when history changes elsewhere */
  refreshKey: number;
  onLoadRun: (result: AnalyseResponseBody) => void;
  onCompareResult?: (diff: RunComparisonSummary) => void;
};

function formatWhen(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

export default function RunHistory({
  refreshKey,
  onLoadRun,
  onCompareResult
}: Props) {
  const [runs, setRuns] = useState<SavedRunRecord[]>([]);
  const [baselineId, setBaselineId] = useState<string>("");
  const [currentId, setCurrentId] = useState<string>("");

  useEffect(() => {
    setRuns(loadRunHistory());
  }, [refreshKey]);

  const byId = useMemo(() => {
    const m = new Map<string, SavedRunRecord>();
    for (const r of runs) m.set(r.id, r);
    return m;
  }, [runs]);

  const handleDelete = (id: string) => {
    if (!confirm("Remove this run from history?")) return;
    deleteRun(id);
    setRuns(loadRunHistory());
    if (baselineId === id) setBaselineId("");
    if (currentId === id) setCurrentId("");
  };

  const handleCompare = () => {
    if (!baselineId || !currentId || baselineId === currentId) return;
    const a = byId.get(baselineId);
    const b = byId.get(currentId);
    if (!a || !b) return;
    const part = compareRuns(a.result, b.result);
    const summary: RunComparisonSummary = {
      baselineId: a.id,
      currentId: b.id,
      domain: a.domain,
      ...part
    };
    onCompareResult?.(summary);
  };

  if (runs.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        <h2 className="text-sm font-semibold text-slate-200">Run history</h2>
        <p className="mt-2 text-xs">
          Completed analyses are saved in this browser (
          <span className="text-slate-300">localStorage</span>). Run an analysis
          to build history — then load past results or compare two runs.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Run history</h2>
        <p className="text-xs text-slate-500">
          Stored locally · up to {MAX_SAVED_RUNS} runs
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-full text-left text-xs text-slate-200">
          <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Domain</th>
              <th className="px-3 py-2">Pages</th>
              <th className="px-3 py-2">Opportunities</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr
                key={r.id}
                className="border-t border-slate-800/80 bg-slate-900/30"
              >
                <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                  {formatWhen(r.createdAt)}
                </td>
                <td className="max-w-[14rem] truncate px-3 py-2 font-mono text-[11px] text-slate-300">
                  {r.domain}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.crawledPageCount}</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.totalOpportunitiesFound}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onLoadRun(r.result)}
                    className="mr-2 text-blue-400 hover:underline"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="text-rose-400/90 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <p className="text-xs font-semibold text-slate-200">Compare two runs</p>
        <p className="mt-1 text-xs text-slate-500">
          Baseline → Current: <span className="text-slate-400">new</span> rows
          appear in Current only;{" "}
          <span className="text-slate-400">removed</span> were only in Baseline.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[10rem] flex-col gap-1 text-[11px] text-slate-400">
            Baseline (older)
            <select
              value={baselineId}
              onChange={(e) => setBaselineId(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="">Select…</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {formatWhen(r.createdAt)} · {r.totalOpportunitiesFound} opp.
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[10rem] flex-col gap-1 text-[11px] text-slate-400">
            Current (newer)
            <select
              value={currentId}
              onChange={(e) => setCurrentId(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="">Select…</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {formatWhen(r.createdAt)} · {r.totalOpportunitiesFound} opp.
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!baselineId || !currentId || baselineId === currentId}
            onClick={handleCompare}
            className="rounded-md border border-violet-600/50 bg-violet-950/40 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Compare
          </button>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { OpportunityResult } from "@/types";
import type { RunComparisonSummary } from "@/lib/run-history";

type DiffShape = Omit<
  RunComparisonSummary,
  "baselineId" | "currentId" | "domain"
>;

type Props = {
  title: string;
  subtitle?: string;
  diff: DiffShape | null;
  domain?: string;
};

const PREVIEW = 12;

export default function RunDiffPanel({ title, subtitle, diff, domain }: Props) {
  const hasAnything = useMemo(() => {
    if (!diff) return false;
    return (
      diff.newCount > 0 ||
      diff.removedCount > 0 ||
      diff.statusChangeCount > 0
    );
  }, [diff]);

  if (!diff || !hasAnything) return null;

  return (
    <section className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-violet-100">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-xs text-violet-200/80">{subtitle}</p>
          )}
          {domain && (
            <p className="mt-1 font-mono text-[11px] text-slate-400">{domain}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-300">
          <span>
            <span className="font-semibold text-emerald-300">+{diff.newCount}</span>{" "}
            new
          </span>
          <span>
            <span className="font-semibold text-rose-300">−{diff.removedCount}</span>{" "}
            removed
          </span>
          <span>
            <span className="font-semibold text-amber-300">
              {diff.statusChangeCount}
            </span>{" "}
            status changes
          </span>
        </div>
      </div>

      {diff.newRows.length > 0 && (
        <RowPreviewTable title="New in this run" rows={diff.newRows} />
      )}
      {diff.removedRows.length > 0 && (
        <RowPreviewTable
          title="Only in previous run (missing now)"
          rows={diff.removedRows}
        />
      )}
      {diff.statusChanges.length > 0 && (
        <StatusChangeTable changes={diff.statusChanges} />
      )}
    </section>
  );
}

function RowPreviewTable({
  title,
  rows
}: {
  title: string;
  rows: OpportunityResult[];
}) {
  const [showAll, setShowAll] = useState(false);
  const slice = showAll ? rows : rows.slice(0, PREVIEW);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {title}
        </span>
        {rows.length > PREVIEW && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-[11px] text-blue-400 hover:underline"
          >
            {showAll ? "Show less" : `Show all (${rows.length})`}
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded border border-slate-800">
        <table className="min-w-full text-left text-[11px] text-slate-200">
          <thead className="bg-slate-950/80 text-slate-500">
            <tr>
              <th className="px-2 py-1.5">Keyword</th>
              <th className="px-2 py-1.5">Source</th>
              <th className="px-2 py-1.5">Destination</th>
              <th className="px-2 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i} className="border-t border-slate-800/80">
                <td className="px-2 py-1.5 align-top">{r.keyword}</td>
                <td className="max-w-[11rem] truncate px-2 py-1.5 align-top text-slate-400">
                  {r.sourceUrl}
                </td>
                <td className="max-w-[11rem] truncate px-2 py-1.5 align-top text-slate-400">
                  {r.destinationUrl}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 align-top text-slate-300">
                  {r.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusChangeTable({
  changes
}: {
  changes: RunComparisonSummary["statusChanges"];
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? changes : changes.slice(0, PREVIEW);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Status changes (same keyword / source / destination)
        </span>
        {changes.length > PREVIEW && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-[11px] text-blue-400 hover:underline"
          >
            {showAll ? "Show less" : `Show all (${changes.length})`}
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded border border-slate-800">
        <table className="min-w-full text-left text-[11px] text-slate-200">
          <thead className="bg-slate-950/80 text-slate-500">
            <tr>
              <th className="px-2 py-1.5">Keyword</th>
              <th className="px-2 py-1.5">Source</th>
              <th className="px-2 py-1.5">Before</th>
              <th className="px-2 py-1.5">After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((sc, i) => (
              <tr key={i} className="border-t border-slate-800/80">
                <td className="px-2 py-1.5 align-top">{sc.keyword}</td>
                <td className="max-w-[14rem] truncate px-2 py-1.5 align-top text-slate-400">
                  {sc.sourceUrl}
                </td>
                <td className="px-2 py-1.5 align-top text-amber-200">
                  {sc.beforeStatus}{" "}
                  <span className="text-slate-500">({sc.beforeScore})</span>
                </td>
                <td className="px-2 py-1.5 align-top text-emerald-200">
                  {sc.afterStatus}{" "}
                  <span className="text-slate-500">({sc.afterScore})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

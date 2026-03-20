"use client";

import { useMemo, useState } from "react";
import type { AnalyseResponseBody, OpportunityResult } from "@/types";

type Props = {
  data: AnalyseResponseBody | null;
};

type SortKey = keyof Pick<
  OpportunityResult,
  "keyword" | "sourceUrl" | "destinationUrl" | "status" | "score"
>;

export default function ResultsTable({ data }: Props) {
  const [keywordFilter, setKeywordFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("keyword");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.results
      .filter((r) =>
        keywordFilter
          ? r.keyword.toLowerCase().includes(keywordFilter.toLowerCase())
          : true
      )
      .filter((r) => (statusFilter ? r.status === statusFilter : true))
      .slice()
      .sort((a, b) => {
        const aVal = a[sortKey] ?? "";
        const bVal = b[sortKey] ?? "";
        if (sortKey === "score") {
          return sortAsc ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
        }
        return sortAsc
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
  }, [data, keywordFilter, statusFilter, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const exportCsv = () => {
    if (!filtered.length) return;
    const header = [
      "group",
      "score",
      "keyword",
      "sourceUrl",
      "sourceTitle",
      "destinationUrl",
      "snippet",
      "status",
      "notes"
    ];
    const rows = filtered.map((r) =>
      header
        .map((key) => {
          const value =
            key === "notes" ? "" : ((r as any)[key] ?? "");
          const escaped = String(value).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "internal-link-opportunities.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) return null;

  const highlightSnippet = (snippet: string, keyword: string) => {
    if (!snippet) return snippet;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return snippet.replace(regex, "<mark>$1</mark>");
  };

  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1 text-xs text-slate-300">
          <p>
            <span className="font-semibold">Crawled pages:</span>{" "}
            {data.crawledPageCount}
          </p>
          <p>
            <span className="font-semibold">Keyword mappings:</span>{" "}
            {data.totalKeywordMappingsAnalysed}
          </p>
          <p>
            <span className="font-semibold">Opportunities found:</span>{" "}
            {data.totalOpportunitiesFound}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Filter by keyword"
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
            className="w-40 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-44 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            <option value="Opportunity found">Opportunity found</option>
            <option value="Already linked">Already linked</option>
            <option value="Source equals destination">
              Source equals destination
            </option>
            <option value="Keyword not found">Keyword not found</option>
            <option value="Linked to different URL">
              Linked to different URL
            </option>
          </select>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!filtered.length}
            className="inline-flex items-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-sm hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/70">
        <table className="min-w-full text-left text-xs text-slate-100">
          <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2">Group</th>
              <th
                className="cursor-pointer px-3 py-2"
                onClick={() => handleSort("score")}
              >
                Score
              </th>
              <th
                className="cursor-pointer px-3 py-2"
                onClick={() => handleSort("keyword")}
              >
                Keyword
              </th>
              <th
                className="cursor-pointer px-3 py-2"
                onClick={() => handleSort("sourceUrl")}
              >
                Source URL
              </th>
              <th className="px-3 py-2">Source title</th>
              <th
                className="cursor-pointer px-3 py-2"
                onClick={() => handleSort("destinationUrl")}
              >
                Destination URL
              </th>
              <th className="px-3 py-2">Snippet</th>
              <th
                className="cursor-pointer px-3 py-2"
                onClick={() => handleSort("status")}
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <>
                <tr
                  key={idx}
                  className={
                    idx % 2 === 0 ? "bg-slate-900/60" : "bg-slate-900/30"
                  }
                >
                  <td className="px-3 py-2 align-top text-slate-300">
                    {r.group ?? "–"}
                  </td>
                  <td className="px-3 py-2 align-top font-semibold text-slate-100">
                    {r.score}
                  </td>
                  <td className="px-3 py-2 align-top font-medium">
                    {r.keyword}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-blue-400 hover:underline"
                    >
                      {r.sourceUrl}
                    </a>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {r.sourceTitle ?? "–"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <a
                      href={r.destinationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-blue-400 hover:underline"
                    >
                      {r.destinationUrl}
                    </a>
                  </td>
                  <td className="px-3 py-2 align-top text-slate-200">
                    {r.snippet ?? "–"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          r.status === "Opportunity found"
                            ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/40"
                            : r.status === "Already linked"
                            ? "bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/40"
                            : r.status === "Keyword not found"
                            ? "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/40"
                            : "bg-purple-500/10 text-purple-300 ring-1 ring-purple-500/40"
                        }`}
                      >
                        {r.status}
                      </span>
                      {r.cannibalisationRisk && (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/50">
                          Cannibalisation risk
                        </span>
                      )}
                      {r.snippet && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedIndex(
                              expandedIndex === idx ? null : idx
                            )
                          }
                          className="text-[11px] text-slate-300 hover:text-slate-100"
                        >
                          {expandedIndex === idx ? "Hide" : "Preview"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedIndex === idx && r.snippet && (
                  <tr className="bg-slate-950/80">
                    <td colSpan={6} className="px-3 pb-3 pt-1 text-[11px]">
                      <div className="rounded-md border border-slate-800 bg-slate-900/80 p-3 text-slate-100">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: highlightSnippet(r.snippet || "", r.keyword)
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {!filtered.length && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm text-slate-400"
                >
                  No results match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}


"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RunHistory from "@/components/RunHistory";
import RunDiffPanel from "@/components/RunDiffPanel";
import type { AnalyseResponseBody } from "@/types";
import type { RunComparisonSummary } from "@/lib/run-history";
import { stashTransferredResult } from "@/lib/last-result-session";

export default function RunHistoryPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [compareDiff, setCompareDiff] = useState<RunComparisonSummary | null>(
    null
  );

  useEffect(() => {
    const bump = () => setRefreshKey((k) => k + 1);
    window.addEventListener("ilo-history-updated", bump);
    window.addEventListener("focus", bump);
    return () => {
      window.removeEventListener("ilo-history-updated", bump);
      window.removeEventListener("focus", bump);
    };
  }, []);

  return (
    <div className="space-y-8 pb-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Run history
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Saved in this browser only.{" "}
          <Link href="/" className="text-blue-400 hover:underline">
            ← Back to Analyze
          </Link>
        </p>
      </header>

      <RunHistory
        refreshKey={refreshKey}
        onLoadRun={(result: AnalyseResponseBody) => {
          stashTransferredResult(result);
          router.push("/");
        }}
        onCompareResult={(summary) => {
          setCompareDiff(summary);
        }}
      />

      {compareDiff && (
        <RunDiffPanel
          title="Compare two saved runs"
          subtitle={`Baseline ${compareDiff.baselineId.slice(0, 8)}… → Current ${compareDiff.currentId.slice(0, 8)}…`}
          domain={compareDiff.domain}
          diff={{
            newCount: compareDiff.newCount,
            removedCount: compareDiff.removedCount,
            statusChangeCount: compareDiff.statusChangeCount,
            newRows: compareDiff.newRows,
            removedRows: compareDiff.removedRows,
            statusChanges: compareDiff.statusChanges
          }}
        />
      )}
    </div>
  );
}

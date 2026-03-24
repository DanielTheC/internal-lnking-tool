"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopicalMap from "@/components/TopicalMap";
import type { AnalyseGraphPayload } from "@/types";
import { readLastAnalyseFromSession } from "@/lib/last-result-session";

export default function TopicalMapPage() {
  const [graph, setGraph] = useState<AnalyseGraphPayload | undefined>(undefined);

  useEffect(() => {
    const apply = () => {
      const last = readLastAnalyseFromSession();
      setGraph(last?.graph);
    };
    apply();
    window.addEventListener("focus", apply);
    window.addEventListener("ilo-history-updated", apply);
    return () => {
      window.removeEventListener("focus", apply);
      window.removeEventListener("ilo-history-updated", apply);
    };
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Topical map
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Uses the graph from your <strong>most recent successful analysis</strong> on
          the Analyze page (same browser tab session).{" "}
          <Link href="/" className="text-blue-400 hover:underline">
            ← Back to Analyze
          </Link>
        </p>
      </header>

      <TopicalMap graph={graph} />
    </div>
  );
}

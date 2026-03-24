"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnalyseGraphPayload, TopicalMapEdgeKind } from "@/types";
import {
  ALL_TOPICAL_KINDS,
  TOPICAL_EDGE_COLORS,
  TOPICAL_EDGE_LABELS
} from "@/lib/topical-map-constants";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center text-sm text-slate-400">
      Loading graph…
    </div>
  )
});

type Props = {
  graph: AnalyseGraphPayload | undefined;
};

type FgNode = {
  id: string;
  label: string;
  crawled: boolean;
  url: string;
};

type FgLink = {
  id: string;
  source: string;
  target: string;
  kind: TopicalMapEdgeKind;
  keywords: string[];
};

function defaultKinds(): Record<TopicalMapEdgeKind, boolean> {
  const o = {} as Record<TopicalMapEdgeKind, boolean>;
  for (const k of ALL_TOPICAL_KINDS) o[k] = true;
  return o;
}

/** Focus node + direct neighbors; keep edges whose endpoints are both in this set. */
function egoOneHop(focusId: string, edges: FgLink[]): FgLink[] {
  const allow = new Set<string>([focusId]);
  for (const e of edges) {
    if (e.source === focusId || e.target === focusId) {
      allow.add(e.source);
      allow.add(e.target);
    }
  }
  return edges.filter((e) => allow.has(e.source) && allow.has(e.target));
}

export default function TopicalMap({ graph }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 480 });
  const [kindOn, setKindOn] = useState(defaultKinds);
  const [keyword, setKeyword] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setDims({ w: Math.max(320, w), h: Math.max(420, Math.round(w * 0.55)) });
    });
    ro.observe(el);
    setDims({
      w: Math.max(320, el.clientWidth),
      h: Math.max(420, Math.round(el.clientWidth * 0.55))
    });
    return () => ro.disconnect();
  }, []);

  const nodeById = useMemo(() => {
    const m = new Map<string, FgNode>();
    for (const n of graph?.nodes ?? []) {
      m.set(n.id, {
        id: n.id,
        label: n.displayLabel,
        crawled: n.crawled,
        url: n.url
      });
    }
    return m;
  }, [graph?.nodes]);

  const fgData = useMemo(() => {
    const base = graph?.edges ?? [];
    let edges: FgLink[] = base
      .filter((e) => kindOn[e.kind])
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        kind: e.kind,
        keywords: e.keywords
      }));

    const q = keyword.trim().toLowerCase();
    if (q) {
      edges = edges.filter((e) => {
        if (e.keywords.some((k) => k.toLowerCase().includes(q))) return true;
        const s = nodeById.get(e.source);
        const t = nodeById.get(e.target);
        return (
          (s &&
            (s.label.toLowerCase().includes(q) ||
              s.url.toLowerCase().includes(q))) ||
          (t &&
            (t.label.toLowerCase().includes(q) ||
              t.url.toLowerCase().includes(q)))
        );
      });
    }

    if (focusId) {
      edges = egoOneHop(focusId, edges);
    }

    const nodeIds = new Set<string>();
    for (const l of edges) {
      nodeIds.add(l.source);
      nodeIds.add(l.target);
    }
    const nodes: FgNode[] = [];
    for (const id of nodeIds) {
      const n = nodeById.get(id);
      if (n) nodes.push(n);
    }

    return { nodes, links: edges };
  }, [graph?.edges, kindOn, keyword, focusId, nodeById]);

  const toggleKind = (k: TopicalMapEdgeKind) => {
    setKindOn((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const clearFocus = useCallback(() => setFocusId(null), []);

  const handleNodeClick = useCallback((node: FgNode) => {
    setFocusId((prev) => (prev === node.id ? null : node.id));
  }, []);

  if (!graph || graph.nodes.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        <h2 className="text-sm font-semibold text-slate-200">Topical map</h2>
        <p className="mt-2 text-xs">
          No graph data for this run. Run a new analysis to build the map (older
          saved runs may not include it).
        </p>
      </section>
    );
  }

  const large = graph.nodes.length > 150;

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Topical map</h2>
        <p className="text-xs text-slate-500">
          {graph.nodes.length} pages · {graph.edges.length} connections
          {large && " · large graph — use filters"}
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <label className="flex flex-col gap-1 text-slate-400">
          Filter keyword / URL
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Mapping keywords or page labels"
            className="min-w-[12rem] rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100 placeholder-slate-600"
          />
        </label>
        {focusId && (
          <div className="flex items-end gap-2">
            <span className="max-w-[20rem] truncate text-slate-500">
              Focus:{" "}
              <span className="font-mono text-[11px] text-slate-300">
                {focusId}
              </span>
            </span>
            <button
              type="button"
              onClick={clearFocus}
              className="rounded-md border border-slate-600 px-2 py-1 text-slate-200 hover:bg-slate-800"
            >
              Clear focus
            </button>
          </div>
        )}
      </div>

      <fieldset className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Connection types (colour key)
        </legend>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {ALL_TOPICAL_KINDS.map((k) => (
            <label
              key={k}
              className="inline-flex cursor-pointer items-center gap-2 text-slate-300"
            >
              <input
                type="checkbox"
                checked={kindOn[k]}
                onChange={() => toggleKind(k)}
                className="rounded border-slate-600"
              />
              <span
                className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-slate-600"
                style={{ backgroundColor: TOPICAL_EDGE_COLORS[k] }}
              />
              <span className="text-[11px]">{TOPICAL_EDGE_LABELS[k]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60"
      >
        <ForceGraph2D
          width={dims.w}
          height={dims.h}
          graphData={fgData}
          nodeId="id"
          nodeLabel={(n) => {
            const o = n as FgNode;
            return `${o.label}\n${o.url}${o.crawled ? "" : "\n(stub)"}`;
          }}
          nodeColor={(n) => ((n as FgNode).crawled ? "#e2e8f0" : "#64748b")}
          nodeVal={() => 3.5}
          linkColor={(l) => TOPICAL_EDGE_COLORS[(l as FgLink).kind]}
          linkWidth={() => 1.2}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkLabel={(l) => {
            const e = l as FgLink;
            return e.keywords.length ? e.keywords.join(", ") : e.kind;
          }}
          onNodeClick={(n) => handleNodeClick(n as FgNode)}
          onBackgroundClick={clearFocus}
          cooldownTicks={large ? 80 : 120}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.35}
        />
      </div>

      <p className="text-xs text-slate-500">
        Click a page to focus its 1-hop neighborhood (click again or background
        to clear). Hover edges for mapping keywords. Labels prefer H1, then title,
        then path.
      </p>
    </section>
  );
}

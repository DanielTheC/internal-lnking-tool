"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GscKeywordMetrics } from "@/types";
import { parseGscCsvToKeywordMap } from "@/lib/gsc-csv";
import { pickBestGscSiteUrl } from "@/lib/gsc-pick-site";

type Connection = {
  id: string;
  email: string;
  label?: string;
  createdAt: number;
};

type SiteEntry = { siteUrl: string; permissionLevel?: string | null };

type ClientPreset = {
  id: string;
  name: string;
  connectionId: string;
  siteUrl: string;
};

const PRESETS_KEY = "ilo-gsc-client-presets";

function loadPresets(): ClientPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter(
      (x): x is ClientPreset =>
        x != null &&
        typeof x === "object" &&
        typeof (x as ClientPreset).id === "string" &&
        typeof (x as ClientPreset).name === "string" &&
        typeof (x as ClientPreset).connectionId === "string" &&
        typeof (x as ClientPreset).siteUrl === "string"
    );
  } catch {
    return [];
  }
}

function savePresets(list: ClientPreset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 28 * 86400000);
  return { start: ymd(start), end: ymd(end) };
}

function connLabel(c: Connection): string {
  if (c.label) return `${c.label} (${c.email})`;
  return c.email;
}

type Props = {
  domain: string;
  gscByKeyword: Record<string, GscKeywordMetrics>;
  setGscByKeyword: (v: Record<string, GscKeywordMetrics>) => void;
  gscFileLabel: string | null;
  setGscFileLabel: (v: string | null) => void;
  gscParseError: string | null;
  setGscParseError: (v: string | null) => void;
};

export default function GscSearchConsoleSection({
  domain,
  gscByKeyword,
  setGscByKeyword,
  gscFileLabel,
  setGscFileLabel,
  gscParseError,
  setGscParseError
}: Props) {
  const [gscApiEnabled, setGscApiEnabled] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [sites, setSites] = useState<SiteEntry[]>([]);
  const [siteUrl, setSiteUrl] = useState("");
  const [dates, setDates] = useState(defaultDateRange);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [connectLabel, setConnectLabel] = useState("");
  const [clientPresets, setClientPresets] = useState<ClientPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [apiBanner, setApiBanner] = useState<string | null>(null);
  const [accountLabelDraft, setAccountLabelDraft] = useState("");
  const [labelSaveBusy, setLabelSaveBusy] = useState(false);
  const [labelSaveHint, setLabelSaveHint] = useState<string | null>(null);

  const refreshConnections = useCallback(async () => {
    const r = await fetch("/api/gsc/status");
    const j = (await r.json()) as { gscApiEnabled?: boolean };
    setGscApiEnabled(Boolean(j.gscApiEnabled));
    if (!j.gscApiEnabled) {
      setConnections([]);
      return;
    }
    const cr = await fetch("/api/gsc/connections");
    if (!cr.ok) return;
    const cj = (await cr.json()) as { connections?: Connection[] };
    setConnections(cj.connections ?? []);
  }, []);

  useEffect(() => {
    void refreshConnections();
    setClientPresets(loadPresets());
  }, [refreshConnections]);

  useEffect(() => {
    const c = connections.find((x) => x.id === connectionId);
    setAccountLabelDraft(c?.label ?? "");
    setLabelSaveHint(null);
    // Only when switching accounts — not when `connections` refreshes (would wipe edits).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("gsc_connected") === "1") {
      setApiBanner(
        "Google account connected. Pick a Search Console property and fetch query data."
      );
      void refreshConnections();
      const u = new URL(window.location.href);
      u.searchParams.delete("gsc_connected");
      window.history.replaceState({}, "", u.pathname + u.search + u.hash);
    }
    const err = params.get("gsc_error");
    if (err) {
      setApiBanner(`Google connection failed: ${err}`);
      const u = new URL(window.location.href);
      u.searchParams.delete("gsc_error");
      window.history.replaceState({}, "", u.pathname + u.search + u.hash);
    }
  }, [refreshConnections]);

  useEffect(() => {
    if (!connectionId || !gscApiEnabled) {
      setSites([]);
      return;
    }
    let cancelled = false;
    setSitesLoading(true);
    setFetchError(null);
    fetch(`/api/gsc/sites?connectionId=${encodeURIComponent(connectionId)}`)
      .then(async (r) => {
        const j = (await r.json()) as { sites?: SiteEntry[]; error?: string };
        if (!r.ok) throw new Error(j.error || "Could not list sites.");
        return j.sites ?? [];
      })
      .then((list) => {
        if (!cancelled) setSites(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setSites([]);
          setFetchError(e instanceof Error ? e.message : "Sites request failed.");
        }
      })
      .finally(() => {
        if (!cancelled) setSitesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connectionId, gscApiEnabled]);

  const siteUrls = useMemo(() => sites.map((s) => s.siteUrl), [sites]);

  useEffect(() => {
    if (siteUrls.length === 0) return;
    const best = pickBestGscSiteUrl(siteUrls, domain);
    if (best) setSiteUrl(best);
  }, [siteUrls, domain]);

  const handleFetchApi = async () => {
    setFetchError(null);
    setApiBanner(null);
    if (!connectionId || !siteUrl) {
      setFetchError("Select a Google account and Search Console property.");
      return;
    }
    setFetchLoading(true);
    try {
      const res = await fetch("/api/gsc/search-analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          siteUrl,
          startDate: dates.start,
          endDate: dates.end
        })
      });
      const j = (await res.json()) as {
        gscByKeyword?: Record<string, GscKeywordMetrics>;
        queryCount?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error || "Request failed.");
      const map = j.gscByKeyword ?? {};
      setGscByKeyword(map);
      setGscFileLabel(
        `GSC API · ${j.queryCount ?? Object.keys(map).length} queries · ${dates.start}–${dates.end}`
      );
      setGscParseError(null);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : "Fetch failed.");
    } finally {
      setFetchLoading(false);
    }
  };

  const saveClientPreset = () => {
    const name = presetName.trim();
    if (!name || !connectionId || !siteUrl) return;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `preset-${Date.now()}`;
    const next = [...clientPresets.filter((p) => p.name !== name), { id, name, connectionId, siteUrl }];
    setClientPresets(next);
    savePresets(next);
    setPresetName("");
  };

  const applyPreset = (id: string) => {
    const p = clientPresets.find((x) => x.id === id);
    if (!p) return;
    setConnectionId(p.connectionId);
    setSiteUrl(p.siteUrl);
  };

  const deletePreset = (id: string) => {
    const next = clientPresets.filter((p) => p.id !== id);
    setClientPresets(next);
    savePresets(next);
  };

  const connectHref = useMemo(() => {
    const q = new URLSearchParams();
    q.set("return", "/");
    if (connectLabel.trim()) q.set("label", connectLabel.trim());
    return `/api/gsc/auth/start?${q.toString()}`;
  }, [connectLabel]);

  const disconnect = async (id: string) => {
    if (!confirm("Disconnect this Google account from this app?")) return;
    const r = await fetch(`/api/gsc/connections/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    if (r.ok) {
      if (connectionId === id) {
        setConnectionId("");
        setSiteUrl("");
        setSites([]);
      }
      void refreshConnections();
    }
  };

  const saveAccountLabel = async () => {
    if (!connectionId) return;
    setLabelSaveBusy(true);
    setLabelSaveHint(null);
    try {
      const res = await fetch(
        `/api/gsc/connections/${encodeURIComponent(connectionId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: accountLabelDraft.trim() || undefined
          })
        }
      );
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Could not save label.");
      await refreshConnections();
      setLabelSaveHint("Label saved.");
      window.setTimeout(() => setLabelSaveHint(null), 2500);
    } catch (e: unknown) {
      setLabelSaveHint(
        e instanceof Error ? e.message : "Could not save label."
      );
    } finally {
      setLabelSaveBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Search Console (optional)
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Import <strong>Performance → Queries</strong> to weight scores by
            demand. Use a CSV export, or connect Google below to pull the same
            data via the API.
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
                setFetchError(null);
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
              Clear data
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

      {gscApiEnabled && (
        <div className="mt-4 space-y-3 border-t border-slate-800/80 pt-4">
          {apiBanner && (
            <p className="text-xs text-amber-200/90">{apiBanner}</p>
          )}
          <p className="text-xs font-medium text-slate-300">
            Google accounts (server-stored, encrypted refresh tokens)
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[140px] flex-1">
              <label className="block text-[11px] text-slate-500">
                Label (optional, next connection)
              </label>
              <input
                type="text"
                placeholder="e.g. Agency account A"
                value={connectLabel}
                onChange={(e) => setConnectLabel(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
              />
            </div>
            <a
              href={connectHref}
              className="inline-flex items-center rounded-md border border-blue-600/60 bg-blue-950/50 px-3 py-1.5 text-xs font-medium text-blue-100 hover:bg-blue-900/50"
            >
              Connect Google
            </a>
          </div>

          {connections.length > 0 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-slate-500">
                    Google account
                  </label>
                  <select
                    value={connectionId}
                    onChange={(e) => {
                      setConnectionId(e.target.value);
                      setSiteUrl("");
                    }}
                    className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                  >
                    <option value="">Select…</option>
                    {connections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {connLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500">
                    Saved client (browser)
                  </label>
                  <div className="mt-0.5 flex gap-1">
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) applyPreset(e.target.value);
                      }}
                      className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                    >
                      <option value="">Load saved client…</option>
                      {clientPresets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {connectionId && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-800/80 bg-slate-950/30 p-2">
                    <div className="min-w-[200px] flex-1">
                      <label className="block text-[11px] text-slate-500">
                        Account display label
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Agency account A"
                        value={accountLabelDraft}
                        onChange={(e) => setAccountLabelDraft(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={labelSaveBusy}
                      onClick={() => void saveAccountLabel()}
                      className="rounded-md border border-slate-600 px-2 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-50"
                    >
                      {labelSaveBusy ? "Saving…" : "Save label"}
                    </button>
                    {labelSaveHint && (
                      <span
                        className={
                          labelSaveHint.startsWith("Label saved")
                            ? "text-[11px] text-emerald-500/90"
                            : "text-[11px] text-red-400"
                        }
                      >
                        {labelSaveHint}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500">
                      Search Console property
                    </label>
                    <select
                      value={siteUrl}
                      onChange={(e) => setSiteUrl(e.target.value)}
                      disabled={sitesLoading}
                      className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 disabled:opacity-60"
                    >
                      <option value="">
                        {sitesLoading ? "Loading properties…" : "Select property…"}
                      </option>
                      {siteUrls.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Matches your Domain field when possible. Use the list from
                      the account that has access to this client&apos;s property.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        Start
                      </label>
                      <input
                        type="date"
                        value={dates.start}
                        onChange={(e) =>
                          setDates((d) => ({ ...d, start: e.target.value }))
                        }
                        className="mt-0.5 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        End
                      </label>
                      <input
                        type="date"
                        value={dates.end}
                        onChange={(e) =>
                          setDates((d) => ({ ...d, end: e.target.value }))
                        }
                        className="mt-0.5 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                    <div className="flex items-end gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setDates({
                            start: ymd(new Date(Date.now() - 7 * 86400000)),
                            end: ymd(new Date())
                          })
                        }
                        className="rounded-md border border-slate-700 px-2 py-1.5 text-[11px] text-slate-300 hover:border-slate-500"
                      >
                        Last 7d
                      </button>
                      <button
                        type="button"
                        onClick={() => setDates(defaultDateRange())}
                        className="rounded-md border border-slate-700 px-2 py-1.5 text-[11px] text-slate-300 hover:border-slate-500"
                      >
                        Last 28d
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDates({
                            start: ymd(new Date(Date.now() - 90 * 86400000)),
                            end: ymd(new Date())
                          })
                        }
                        className="rounded-md border border-slate-700 px-2 py-1.5 text-[11px] text-slate-300 hover:border-slate-500"
                      >
                        Last 90d
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <button
                      type="button"
                      disabled={fetchLoading || !siteUrl}
                      onClick={() => void handleFetchApi()}
                      className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {fetchLoading ? "Fetching…" : "Fetch from Search Console"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void disconnect(connectionId)}
                      className="text-xs text-slate-500 hover:text-red-400"
                    >
                      Disconnect this account
                    </button>
                  </div>

                  <div className="flex flex-wrap items-end gap-2 border-t border-slate-800/80 pt-3">
                    <input
                      type="text"
                      placeholder="Client preset name"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      className="w-44 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={!presetName.trim() || !connectionId || !siteUrl}
                      onClick={saveClientPreset}
                      className="rounded-md border border-slate-600 px-2 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-50"
                    >
                      Save client preset
                    </button>
                  </div>
                  {clientPresets.length > 0 && (
                    <ul className="text-[11px] text-slate-500">
                      {clientPresets.map((p) => (
                        <li key={p.id} className="flex items-center gap-2">
                          <span className="text-slate-400">{p.name}</span>
                          <button
                            type="button"
                            className="text-red-400/80 hover:text-red-300"
                            onClick={() => deletePreset(p.id)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {fetchError && (
                <p className="text-xs text-red-400">{fetchError}</p>
              )}
            </>
          )}

          {connections.length === 0 && (
            <p className="text-xs text-slate-500">
              No accounts connected yet. Use <strong>Connect Google</strong> for
              each agency Google account (you can add several). Then choose the
              client property and fetch.
            </p>
          )}
        </div>
      )}

      {!gscApiEnabled && (
        <p className="mt-3 border-t border-slate-800/80 pt-3 text-[11px] text-slate-500">
          API pull is unavailable: set{" "}
          <code className="text-slate-400">GOOGLE_CLIENT_ID</code>,{" "}
          <code className="text-slate-400">GOOGLE_CLIENT_SECRET</code>,{" "}
          <code className="text-slate-400">GSC_OAUTH_REDIRECT_URI</code>, and{" "}
          <code className="text-slate-400">GSC_ENCRYPTION_SECRET</code> on the
          server (see README). CSV upload still works.
        </p>
      )}
    </div>
  );
}

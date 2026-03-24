import type { AnalyseResponseBody } from "@/types";

const LAST_KEY = "ilo-last-analyse";
const TRANSFER_KEY = "ilo-loaded-result";

/** Latest successful analysis (for Topical map page and cross-page use). */
export function saveLastAnalyseToSession(result: AnalyseResponseBody): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LAST_KEY, JSON.stringify(result));
  } catch {
    // quota or private mode
  }
}

export function readLastAnalyseFromSession(): AnalyseResponseBody | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LAST_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AnalyseResponseBody;
  } catch {
    return null;
  }
}

/** Run history "Load" → home reads once and applies to results. */
export function stashTransferredResult(result: AnalyseResponseBody): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TRANSFER_KEY, JSON.stringify(result));
  } catch {
    // ignore
  }
}

export function takeTransferredResult(): AnalyseResponseBody | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(TRANSFER_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(TRANSFER_KEY);
    return JSON.parse(raw) as AnalyseResponseBody;
  } catch {
    return null;
  }
}

export function notifyRunHistoryUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("ilo-history-updated"));
}

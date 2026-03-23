/**
 * Best-effort message from a failed fetch Response (JSON { error }, plain text, or status).
 */
export async function parseFailedFetchResponse(res: Response): Promise<string> {
  const statusBit = `${res.status} ${res.statusText || ""}`.trim();
  let text = "";
  try {
    text = await res.text();
  } catch {
    return res.status === 504 || res.status === 408
      ? `${statusBit} — server took too long (try raising "Crawl limit" above 16 for chunked crawling).`
      : statusBit || "Request failed.";
  }

  const trimmed = text.trim();
  if (trimmed) {
    try {
      const j = JSON.parse(trimmed) as { error?: string; message?: string };
      if (typeof j.error === "string" && j.error) return j.error;
      if (typeof j.message === "string" && j.message) return j.message;
    } catch {
      // not JSON
    }
    if (trimmed.length <= 400) return `${statusBit}: ${trimmed}`;
    return `${statusBit}: ${trimmed.slice(0, 400)}…`;
  }

  if (res.status === 504 || res.status === 408) {
    return `${statusBit} — timed out. Try "Crawl limit" above 16 to use smaller crawl steps, or fewer pages.`;
  }

  return statusBit || "Request failed.";
}

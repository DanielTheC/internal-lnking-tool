import type { GscKeywordMetrics } from "@/types";

/**
 * Parse one CSV line with quoted fields (Google Search Console export style).
 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, " ");
}

function parseNumber(raw: string): number {
  const s = raw.replace(/,/g, ".").replace(/[^\d.-]/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

type HeaderKind =
  | "query"
  | "page"
  | "clicks"
  | "impressions"
  | "position"
  | "ctr";

/** Recognise GSC Performance export column names (EN + common variants). */
function columnKind(normalizedHeader: string): HeaderKind | null {
  const h = normalizedHeader;
  if (
    h === "query" ||
    h === "top queries" ||
    h === "suchanfrage" ||
    h === "terme" ||
    h === "consulta"
  ) {
    return "query";
  }
  if (
    h === "page" ||
    h === "url" ||
    h === "landing page" ||
    h === "seite" ||
    h === "pagina"
  ) {
    return "page";
  }
  if (h === "clicks" || h === "klicks" || h === "clic" || h === "clics") {
    return "clicks";
  }
  if (
    h === "impressions" ||
    h === "einblendungen" ||
    h === "impressioni" ||
    h === "impresiones"
  ) {
    return "impressions";
  }
  if (
    h === "position" ||
    h === "ctr" ||
    h === "average position" ||
    h === "durchschn. position" ||
    h === "posizione media"
  ) {
    // CTR column should not map to position — handle below
    if (h === "ctr") return "ctr";
    return "position";
  }
  return null;
}

type GscRowInternal = {
  query: string;
  page?: string;
  clicks: number;
  impressions: number;
  position: number;
};

/**
 * Parse a GSC Performance table export (CSV). Aggregates duplicate queries:
 * sums clicks & impressions; position is impression-weighted average.
 */
export function parseGscCsvToKeywordMap(
  fileText: string
): Record<string, GscKeywordMetrics> {
  const text = fileText.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {};
  }

  const headerCells = parseCsvLine(lines[0]).map(normHeader);
  const idx: Partial<Record<keyof GscRowInternal, number>> = {};
  const used = new Set<number>();

  headerCells.forEach((h, i) => {
    const kind = columnKind(h);
    if (!kind) return;
    if (used.has(i)) return;
    if (kind === "ctr") return;
    if (idx[kind] === undefined) {
      idx[kind] = i;
      used.add(i);
    }
  });

  if (idx.query === undefined || idx.clicks === undefined || idx.impressions === undefined) {
    throw new Error(
      "Could not find required columns. Need Query (or equivalent), Clicks, and Impressions."
    );
  }

  const rows: GscRowInternal[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r]);
    if (cells.length <= Math.max(idx.query!, idx.clicks!, idx.impressions!)) {
      continue;
    }
    const query = cells[idx.query!]?.trim() ?? "";
    if (!query) continue;
    const clicks = parseNumber(cells[idx.clicks!] ?? "0");
    const impressions = parseNumber(cells[idx.impressions!] ?? "0");
    let position = 0;
    if (idx.position !== undefined) {
      position = parseNumber(cells[idx.position] ?? "0");
    }
    rows.push({ query, clicks, impressions, position });
  }

  /** query (lowercase) → aggregate */
  const agg = new Map<
    string,
    { clicks: number; impressions: number; posWeight: number }
  >();

  for (const row of rows) {
    const key = row.query.toLowerCase();
    const cur = agg.get(key) ?? {
      clicks: 0,
      impressions: 0,
      posWeight: 0
    };
    cur.clicks += row.clicks;
    cur.impressions += row.impressions;
    if (row.position > 0 && row.impressions > 0) {
      cur.posWeight += row.position * row.impressions;
    }
    agg.set(key, cur);
  }

  const out: Record<string, GscKeywordMetrics> = {};
  for (const [key, v] of agg) {
    const position =
      v.impressions > 0 && v.posWeight > 0
        ? Math.round((v.posWeight / v.impressions) * 100) / 100
        : undefined;
    out[key] = {
      clicks: v.clicks,
      impressions: v.impressions,
      position
    };
  }

  return out;
}

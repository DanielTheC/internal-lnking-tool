import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { SerializableUrlCacheEntry } from "@/types";
import { getRedis, isRedisConfigured } from "@/lib/crawl-queue-redis";

const REDIS_KEY_PREFIX = "ilo:crawl:incr:";
const REDIS_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const MAX_ENTRIES = 5000;

function cacheOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function redisKeyForOrigin(origin: string): string {
  return `${REDIS_KEY_PREFIX}${encodeURIComponent(cacheOrigin(origin))}`;
}

function localCachePath(origin: string): string {
  const o = cacheOrigin(origin);
  const safe = encodeURIComponent(o).replace(/%/g, "_");
  return path.join(process.cwd(), ".cache", "crawl-incremental", `${safe}.json`);
}

export function isIncrementalPersistenceAvailable(): boolean {
  if (isRedisConfigured()) return true;
  if (process.env.CRAWL_INCREMENTAL_FILE === "1") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

function trimCache(
  cache: Record<string, SerializableUrlCacheEntry>
): Record<string, SerializableUrlCacheEntry> {
  const keys = Object.keys(cache);
  if (keys.length <= MAX_ENTRIES) return cache;
  const sorted = [...keys].sort(
    (a, b) => (cache[a]?.savedAt ?? 0) - (cache[b]?.savedAt ?? 0)
  );
  const drop = sorted.slice(0, keys.length - MAX_ENTRIES);
  const next = { ...cache };
  for (const k of drop) delete next[k];
  return next;
}

/**
 * Load persisted URL validators + cached PageData for conditional GET / 304 reuse.
 */
export async function loadUrlCache(
  origin: string
): Promise<Record<string, SerializableUrlCacheEntry>> {
  const r = getRedis();
  if (r) {
    try {
      const raw = await r.get(redisKeyForOrigin(origin));
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, SerializableUrlCacheEntry>;
        return typeof parsed === "object" && parsed ? parsed : {};
      }
    } catch (e) {
      console.warn("loadUrlCache Redis failed", e);
    }
  }

  if (!isIncrementalPersistenceAvailable() || isRedisConfigured()) {
    return {};
  }

  try {
    const p = localCachePath(origin);
    const raw = await readFile(p, "utf8");
    const parsed = JSON.parse(raw) as Record<string, SerializableUrlCacheEntry>;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Persist merged cache (validators + full PageData for 304 replay).
 */
export async function saveUrlCache(
  origin: string,
  cache: Record<string, SerializableUrlCacheEntry>
): Promise<void> {
  const trimmed = trimCache(cache);
  const payload = JSON.stringify(trimmed);

  const r = getRedis();
  if (r) {
    try {
      const key = redisKeyForOrigin(origin);
      await r.multi().set(key, payload).expire(key, REDIS_TTL_SEC).exec();
      return;
    } catch (e) {
      console.warn("saveUrlCache Redis failed", e);
    }
  }

  if (!isIncrementalPersistenceAvailable() || isRedisConfigured()) {
    return;
  }

  try {
    const p = localCachePath(origin);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, payload, "utf8");
  } catch (e) {
    console.warn("saveUrlCache file failed", e);
  }
}

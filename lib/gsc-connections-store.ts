import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getRedis, isRedisConfigured } from "@/lib/crawl-queue-redis";
import { encryptJson, decryptJson } from "@/lib/gsc-crypto";
import type {
  GscConnectionPublic,
  GscConnectionStored
} from "@/lib/gsc-connections-types";

const REDIS_KEY = "ilo:gsc:connections:blob:v1";
const FILE = path.join(process.cwd(), ".data", "gsc-connections.enc");

type BlobShape = { connections: GscConnectionStored[] };

async function readEncryptedBlob(): Promise<string | null> {
  if (isRedisConfigured()) {
    const r = getRedis();
    if (!r) return null;
    return r.get(REDIS_KEY);
  }
  try {
    return await fs.readFile(FILE, "utf8");
  } catch {
    return null;
  }
}

async function writeEncryptedBlob(s: string): Promise<void> {
  if (isRedisConfigured()) {
    const r = getRedis();
    if (!r) throw new Error("REDIS_URL is set but Redis client is unavailable");
    await r.set(REDIS_KEY, s);
    return;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, s, "utf8");
}

async function loadConnections(): Promise<GscConnectionStored[]> {
  const blob = await readEncryptedBlob();
  if (!blob) return [];
  try {
    const dec = decryptJson<BlobShape>(blob);
    return Array.isArray(dec.connections) ? dec.connections : [];
  } catch {
    return [];
  }
}

async function saveConnections(list: GscConnectionStored[]): Promise<void> {
  const enc = encryptJson({ connections: list } satisfies BlobShape);
  await writeEncryptedBlob(enc);
}

export async function listGscConnectionsPublic(): Promise<GscConnectionPublic[]> {
  const list = await loadConnections();
  return list.map(({ refreshToken: _r, ...rest }) => rest);
}

export async function getGscConnectionById(
  id: string
): Promise<GscConnectionStored | null> {
  const list = await loadConnections();
  return list.find((c) => c.id === id) ?? null;
}

export async function addGscConnection(input: {
  email: string;
  refreshToken: string;
  label?: string;
}): Promise<GscConnectionPublic> {
  const list = await loadConnections();
  const id = randomUUID();
  const row: GscConnectionStored = {
    id,
    email: input.email,
    label: input.label,
    createdAt: Date.now(),
    refreshToken: input.refreshToken
  };
  list.push(row);
  await saveConnections(list);
  const { refreshToken: _r, ...pub } = row;
  return pub;
}

export async function deleteGscConnection(id: string): Promise<boolean> {
  const list = await loadConnections();
  const next = list.filter((c) => c.id !== id);
  if (next.length === list.length) return false;
  await saveConnections(next);
  return true;
}

export async function updateGscConnectionLabel(
  id: string,
  label: string | undefined
): Promise<GscConnectionPublic | null> {
  const list = await loadConnections();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], label: label?.trim() || undefined };
  await saveConnections(list);
  const { refreshToken: _r, ...pub } = list[idx];
  return pub;
}

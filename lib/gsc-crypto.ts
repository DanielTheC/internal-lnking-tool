import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32;

function getKey(): Buffer {
  const secret = process.env.GSC_ENCRYPTION_SECRET?.trim();
  if (!secret) {
    throw new Error("GSC_ENCRYPTION_SECRET is not set");
  }
  return scryptSync(secret, "ilo-gsc-salt-v1", KEY_LEN);
}

export function encryptJson(obj: unknown): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const plain = Buffer.from(JSON.stringify(obj), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptJson<T>(blob: string): T {
  const key = getKey();
  const buf = Buffer.from(blob, "base64url");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const enc = buf.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as T;
}

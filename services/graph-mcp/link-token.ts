import { timingSafeEqual } from "node:crypto";
import { deflateSync, inflateSync } from "fflate";

/**
 * Download-link tokens. A link carries its whole source, so new tokens are deflated JSON in
 * base64url with a leading "z" (roughly half to a third of the old length). Old tokens are plain
 * base64url JSON, which always starts with "ey", and are still read until they expire.
 */
const MAX_JSON_BYTES = 512 * 1024;
export function packToken(value: unknown): string {
  const json = new TextEncoder().encode(JSON.stringify(value));
  return "z" + Buffer.from(deflateSync(json, { level: 9 })).toString("base64url");
}
export function unpackToken(token: string): unknown {
  if (!token.startsWith("z")) return JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  const bytes = inflateSync(Buffer.from(token.slice(1), "base64url"), { out: new Uint8Array(MAX_JSON_BYTES) });
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

/** True when one of the service keys signed this exact token. Checked before anything is unpacked. */
export function signedByAny(token: string, signature: string, keys: Record<string, string>, sign: (token: string, key: string) => string): boolean {
  const given = Buffer.from(signature);
  return Object.values(keys).some((key) => {
    const expected = Buffer.from(sign(token, key));
    return expected.length === given.length && timingSafeEqual(given, expected);
  });
}

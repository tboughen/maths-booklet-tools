/**
 * The shared envelope foundation for every MathsDock diagram family: one SHA-256 content hash,
 * one canonical-JSON rule, one link encoding and one place that says how a family reads its
 * saved files. Before this package each core re-implemented these under different names
 * (canonical, canonicalRatio, canonicalEnvelope, encode, encodeRatio, ...).
 *
 * Pure: no Node, browser-only or raster imports, so the website, the cores and the connector
 * all read it. Web Crypto (crypto.subtle) is present in every runtime we support.
 *
 * Hash stability. A family's contentHash is the SHA-256 of its canonical JSON. The families that
 * existed before this package use "schema-order" canonical JSON: JSON.stringify of the validated
 * envelope, so keys follow the zod schema's declaration order. Those hashes are frozen by the
 * golden corpus test (packages/diagram-core/src/golden.test.ts); a zod upgrade or a schema edit
 * that reorders keys fails that test instead of silently breaking baseHash revisions and links.
 * New families should use "sorted" canonical JSON, which does not depend on schema order at all.
 */

/** Lower-case hex SHA-256 of UTF-8 text. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A contentHash: 64 lower-case hex characters. */
export const CONTENT_HASH = /^[0-9a-f]{64}$/;

/**
 * JSON with object keys sorted at every level (arrays keep their order). Undefined object values
 * are dropped, as JSON.stringify does; non-finite numbers are refused rather than written as null.
 */
export function sortedJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw Error("Canonical JSON cannot hold a non-finite number.");
    if (typeof value === "bigint") throw Error("Canonical JSON cannot hold a bigint.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : sortedJson(v))).join(",")}]`;
  const entries = Object.keys(value)
    .sort()
    .flatMap((k) => {
      const v = (value as Record<string, unknown>)[k];
      return v === undefined || typeof v === "function" ? [] : [`${JSON.stringify(k)}:${sortedJson(v)}`];
    });
  return `{${entries.join(",")}}`;
}

/** UTF-8 text as unpadded base64url, the encoding every editor link uses. */
export function toBase64Url(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

/** Inverse of toBase64Url. Refuses anything that is not base64url or not valid UTF-8. */
export function fromBase64Url(token: string, maxLength = 16_000): string {
  if (token.length > maxLength || !/^[A-Za-z0-9_-]*$/.test(token)) throw Error("Invalid editable link.");
  const binary = atob(token.replaceAll("-", "+").replaceAll("_", "/"));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export type CanonicalRule = "schema-order" | "sorted";

export interface EnvelopeDefinition<E> {
  /** The family's kind, as the diagram registry names it. */
  kind: string;
  /**
   * Full validation of a saved or supplied envelope. It must read every historical schema
   * version the family has issued, returning it unchanged in meaning: upgrades are explicit.
   */
  validate(raw: unknown): E;
  /**
   * "schema-order" (the families that predate this package; frozen by the golden corpus) or
   * "sorted" (new families). A family with its own canonical form passes a function instead.
   */
  canonical: CanonicalRule | ((envelope: E) => string);
}

export interface Envelope<E> {
  kind: string;
  validate(raw: unknown): E;
  /** The exact text the content hash and editor links are made from. */
  canonical(envelope: E): string;
  /** SHA-256 of the canonical JSON: the contentHash a revision must quote as baseHash. */
  contentHash(envelope: E): Promise<string>;
  /** The canonical JSON as unpadded base64url, for editor links. */
  encodeLink(envelope: E): string;
  /** Reads an editor-link payload back through validate(). */
  decodeLink(token: string, maxLength?: number): E;
}

/** One family's envelope helpers from its validate function and canonical rule. */
export function defineEnvelope<E>(definition: EnvelopeDefinition<E>): Envelope<E> {
  const rule = definition.canonical;
  const canonical =
    typeof rule === "function" ? (e: E) => rule(definition.validate(e)) : rule === "sorted" ? (e: E) => sortedJson(definition.validate(e)) : (e: E) => JSON.stringify(definition.validate(e));
  return {
    kind: definition.kind,
    validate: definition.validate,
    canonical,
    contentHash: (e) => sha256Hex(canonical(e)),
    encodeLink: (e) => toBase64Url(canonical(e)),
    decodeLink: (token, maxLength) => definition.validate(JSON.parse(fromBase64Url(token, maxLength))),
  };
}

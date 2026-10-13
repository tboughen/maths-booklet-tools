import { validate, defaultEnvelope, apply } from "./model";
import {
  revisionSchema,
  type ValueEnvelope,
  type ValueOperation,
} from "./schema";
export * from "./schema";
export * from "./model";
export * from "./svg";
export const MAX_FILE_BYTES = 64_000;
export const MAX_LINK_LENGTH = 16_000;
export function canonical(e: ValueEnvelope) {
  return JSON.stringify(validate(e));
}
export function parseFile(raw: string): ValueEnvelope {
  if (new TextEncoder().encode(raw).length > MAX_FILE_BYTES)
    throw Error("The editable file is too large.");
  return validate(JSON.parse(raw));
}
export function encode(e: ValueEnvelope) {
  const bytes = new TextEncoder().encode(canonical(e));
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}
export function decode(token: string): ValueEnvelope {
  if (token.length > MAX_LINK_LENGTH || !/^[-_a-zA-Z0-9]+$/.test(token))
    throw Error("Invalid editable link.");
  const binary = atob(token.replaceAll("-", "+").replaceAll("_", "/"));
  return parseFile(
    new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    ),
  );
}
export function editorLink(e: ValueEnvelope, base: string): string {
  const url = new URL(base);
  const draft = url.searchParams.get("draft");
  url.search = "?tool=value-table-graph";
  if (draft && /^[a-zA-Z0-9_-]{1,40}$/.test(draft))
    url.searchParams.set("draft", draft);
  url.hash = "values=" + encode(e);
  if (url.href.length > MAX_LINK_LENGTH)
    throw Error(
      "This document is too large for a link. Use its editable file.",
    );
  return url.href;
}
export async function contentHash(e: ValueEnvelope) {
  const bytes = new TextEncoder().encode(canonical(e));
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function create(spec?: unknown) {
  return spec === undefined ? defaultEnvelope() : validate(spec);
}
export async function revise(raw: unknown) {
  const input = revisionSchema.parse(raw);
  const current = validate(input.envelope);
  if ((await contentHash(current)) !== input.baseHash)
    throw Error(
      "The base hash is stale. Use the latest returned envelope and hash.",
    );
  return apply(current, input.operations as ValueOperation[]);
}

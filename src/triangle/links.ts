import {
  canonical,
  parseFile,
  type Envelope,
} from "../../packages/triangle-core/src";
export const MAX_TRIANGLE_LINK_LENGTH = 16_000;
export function triangleEditorLink(envelope: Envelope, base: string): string {
  const text = canonical(envelope);
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 64_000)
    throw Error(
      "This diagram is too large for a link. Save an editable file instead.",
    );
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const url = new URL(base);
  url.search = "?tool=triangle";
  url.hash =
    "triangle=" +
    btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
  if (url.href.length > MAX_TRIANGLE_LINK_LENGTH)
    throw Error(
      "This diagram is too large for a link. Save an editable file instead.",
    );
  return url.href;
}
export function parseTriangleLink(href: string): Envelope {
  const url = new URL(href);
  if (
    href.length > MAX_TRIANGLE_LINK_LENGTH ||
    url.searchParams.get("tool") !== "triangle" ||
    !/^#triangle=[A-Za-z0-9_-]+$/.test(url.hash)
  )
    throw Error(
      "This is not a supported editable Triangle link. Open an editable file instead.",
    );
  try {
    const binary = atob(
      url.hash.slice(10).replaceAll("-", "+").replaceAll("_", "/"),
    );
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    );
    if (new TextEncoder().encode(text).length > 64_000)
      throw Error("Too large");
    return parseFile(text);
  } catch {
    throw Error(
      "This Triangle link could not be read. Open an editable file instead.",
    );
  }
}

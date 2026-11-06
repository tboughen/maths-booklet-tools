import { linkOpensTool, setToolPage } from "../site/routes";
import {
  canonical,
  parseFile,
  type Envelope,
} from "../../packages/chart-core/src";
export const MAX_CHART_LINK_LENGTH = 16_000;
export function chartEditorLink(envelope: Envelope, base: string): string {
  const text = canonical(envelope);
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 40_000)
    throw Error(
      "This chart is too large for a link. Save an editable file instead.",
    );
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const url = new URL(base);
  setToolPage(url, "charts");
  url.hash =
    "chart=" +
    btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
  if (url.href.length > MAX_CHART_LINK_LENGTH)
    throw Error(
      "This chart is too large for a link. Save an editable file instead.",
    );
  return url.href;
}
export function parseChartLink(href: string): Envelope {
  const url = new URL(href);
  if (
    href.length > MAX_CHART_LINK_LENGTH ||
    !linkOpensTool(url, "charts") ||
    !/^#chart=[A-Za-z0-9_-]+$/.test(url.hash)
  )
    throw Error(
      "This is not a supported editable chart link. Open an editable file instead.",
    );
  try {
    const binary = atob(
      url.hash.slice(7).replaceAll("-", "+").replaceAll("_", "/"),
    );
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    );
    if (new TextEncoder().encode(text).length > 40_000)
      throw Error("Too large");
    return parseFile(text);
  } catch {
    throw Error(
      "This chart link could not be read. Open an editable file instead.",
    );
  }
}

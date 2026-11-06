import { linkOpensTool, setToolPage } from "../site/routes";
import { canonical, decodeLinkHash, MAX_LINK_LENGTH, type Envelope } from "../../packages/probability-tree-core/src";

export function treeEditorLink(envelope: Envelope, base: string): string {
  const bytes = new TextEncoder().encode(canonical(envelope));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const url = new URL(base);
  setToolPage(url, "probability-tree");
  url.hash = "tree=" + btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
  if (url.href.length > MAX_LINK_LENGTH)
    throw Error("This tree is too large for a link. Save an editable file instead.");
  return url.href;
}
export function parseTreeLink(href: string): Envelope {
  const url = new URL(href);
  if (href.length > MAX_LINK_LENGTH || !linkOpensTool(url, "probability-tree"))
    throw Error("This is not a supported probability tree link. Open an editable file instead.");
  return decodeLinkHash(url.hash);
}

import { linkOpensTool, setToolPage } from "../site/routes";
import { decodeLinkHash, linkHash, LINK_PREFIX, MAX_LINK_LENGTH, type Envelope } from "../../packages/factor-tree-core/src";

export { LINK_PREFIX };
export function factorTreeLink(envelope: Envelope, base: string): string {
  const url = new URL(base);
  setToolPage(url, "factor-tree");
  url.hash = linkHash(envelope);
  if (url.href.length > MAX_LINK_LENGTH) throw Error("This diagram is too large for a link. Save an editable file instead.");
  return url.href;
}
export function parseFactorTreeLink(href: string): Envelope {
  const url = new URL(href);
  if (href.length > MAX_LINK_LENGTH || !linkOpensTool(url, "factor-tree"))
    throw Error("This is not a supported factor tree link. Open an editable file instead.");
  return decodeLinkHash(url.hash);
}

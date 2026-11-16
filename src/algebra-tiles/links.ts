import { linkOpensTool, setToolPage } from "../site/routes";
import { decodeLinkHash, linkHash, LINK_PREFIX, MAX_LINK_LENGTH, type Envelope } from "../../packages/algebra-tile-core/src";

export { LINK_PREFIX };
export function algebraTilesLink(envelope: Envelope, base: string): string {
  const url = new URL(base);
  setToolPage(url, "algebra-tiles");
  url.hash = linkHash(envelope);
  if (url.href.length > MAX_LINK_LENGTH) throw Error("This diagram is too large for a link. Save an editable file instead.");
  return url.href;
}
export function parseAlgebraTilesLink(href: string): Envelope {
  const url = new URL(href);
  if (href.length > MAX_LINK_LENGTH || !linkOpensTool(url, "algebra-tiles"))
    throw Error("This is not a supported algebra tiles link. Open an editable file instead.");
  return decodeLinkHash(url.hash);
}

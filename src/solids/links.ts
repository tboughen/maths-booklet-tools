import { linkOpensTool, setToolPage } from "../site/routes";
import { decodeLinkHash, linkHash, LINK_PREFIX, MAX_LINK_LENGTH, type Envelope } from "../../packages/solid-core/src";

export { LINK_PREFIX };
export function solidsLink(envelope: Envelope, base: string): string {
  const url = new URL(base);
  setToolPage(url, "solids");
  url.hash = linkHash(envelope);
  if (url.href.length > MAX_LINK_LENGTH) throw Error("This drawing is too large for a link. Save an editable file instead.");
  return url.href;
}
export function parseSolidsLink(href: string): Envelope {
  const url = new URL(href);
  if (href.length > MAX_LINK_LENGTH || !linkOpensTool(url, "solids")) throw Error("This is not a supported 3D solids link. Open an editable file instead.");
  return decodeLinkHash(url.hash);
}

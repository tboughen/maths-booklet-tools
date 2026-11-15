import { linkOpensTool, setToolPage } from "../site/routes";
import { decodeLinkHash, linkHash, LINK_PREFIX, MAX_LINK_LENGTH, type Envelope } from "../../packages/area-core/src";

export { LINK_PREFIX };
export function areaLink(envelope: Envelope, base: string): string {
  const url = new URL(base);
  setToolPage(url, "area");
  url.hash = linkHash(envelope);
  if (url.href.length > MAX_LINK_LENGTH) throw Error("This diagram is too large for a link. Save an editable file instead.");
  return url.href;
}
export function parseAreaLink(href: string): Envelope {
  const url = new URL(href);
  if (href.length > MAX_LINK_LENGTH || !linkOpensTool(url, "area")) throw Error("This is not a supported area and perimeter link. Open an editable file instead.");
  return decodeLinkHash(url.hash);
}

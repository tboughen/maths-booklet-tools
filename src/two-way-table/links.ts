import { linkOpensTool, setToolPage } from "../site/routes";
import { decodeLinkHash, linkHash, LINK_PREFIX, MAX_LINK_LENGTH, type Envelope } from "../../packages/two-way-table-core/src";

export { LINK_PREFIX };
export function twoWayTableLink(envelope: Envelope, base: string): string {
  const url = new URL(base);
  setToolPage(url, "two-way-table");
  url.hash = linkHash(envelope);
  if (url.href.length > MAX_LINK_LENGTH) throw Error("This table is too large for a link. Save an editable file instead.");
  return url.href;
}
export function parseTwoWayTableLink(href: string): Envelope {
  const url = new URL(href);
  if (href.length > MAX_LINK_LENGTH || !linkOpensTool(url, "two-way-table"))
    throw Error("This is not a supported two-way table link. Open an editable file instead.");
  return decodeLinkHash(url.hash);
}

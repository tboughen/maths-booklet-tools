import { linkOpensTool, setToolPage } from "../site/routes";
import { decodeLinkHash, linkHash, LINK_PREFIX, MAX_LINK_LENGTH, type Envelope } from "../../packages/sample-space-core/src";

export { LINK_PREFIX };
export function sampleSpaceLink(envelope: Envelope, base: string): string {
  const url = new URL(base);
  setToolPage(url, "sample-space");
  url.hash = linkHash(envelope);
  if (url.href.length > MAX_LINK_LENGTH) throw Error("This table is too large for a link. Save an editable file instead.");
  return url.href;
}
export function parseSampleSpaceLink(href: string): Envelope {
  const url = new URL(href);
  if (href.length > MAX_LINK_LENGTH || !linkOpensTool(url, "sample-space"))
    throw Error("This is not a supported sample space link. Open an editable file instead.");
  return decodeLinkHash(url.hash);
}

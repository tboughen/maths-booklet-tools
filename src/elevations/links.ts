import { linkOpensTool, setToolPage } from "../site/routes";
import { decodeLinkHash, linkHash, LINK_PREFIX, MAX_LINK_LENGTH, type Envelope } from "../../packages/elevation-core/src";

export { LINK_PREFIX };
export function elevationsLink(envelope: Envelope, base: string): string {
  const url = new URL(base);
  setToolPage(url, "elevations");
  url.hash = linkHash(envelope);
  if (url.href.length > MAX_LINK_LENGTH) throw Error("These views are too large for a link. Save an editable file instead.");
  return url.href;
}
export function parseElevationsLink(href: string): Envelope {
  const url = new URL(href);
  if (href.length > MAX_LINK_LENGTH || !linkOpensTool(url, "elevations"))
    throw Error("This is not a supported plans and elevations link. Open an editable file instead.");
  return decodeLinkHash(url.hash);
}

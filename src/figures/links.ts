import { linkOpensTool, setToolPage } from "../site/routes";
import { decodeLinkHash, linkHash, LINK_PREFIX, MAX_LINK_LENGTH, type Envelope } from "../../packages/figure-core/src";

export { LINK_PREFIX };
export function figuresLink(envelope: Envelope, base: string): string {
  const url = new URL(base);
  setToolPage(url, "figures");
  url.hash = linkHash(envelope);
  if (url.href.length > MAX_LINK_LENGTH) throw Error("This figure is too large for a link. Save an editable file instead.");
  return url.href;
}
export function parseFiguresLink(href: string): Envelope {
  const url = new URL(href);
  if (href.length > MAX_LINK_LENGTH || !linkOpensTool(url, "figures")) throw Error("This is not a supported geometry figure link. Open an editable file instead.");
  return decodeLinkHash(url.hash);
}

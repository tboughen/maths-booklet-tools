import { linkOpensTool, setToolPage } from "../site/routes";
import {
  canonical,
  parseFile,
  type Envelope,
} from "../../packages/algebra-grid-core/src";
export function editorLink(e: Envelope, base: string) {
  const bytes = new TextEncoder().encode(canonical(e));
  let binary = "";
  bytes.forEach((v) => {
    binary += String.fromCharCode(v);
  });
  const u = new URL(base);
  setToolPage(u, "expanding-factorising");
  u.hash =
    "algebra-grid=" +
    btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  if (u.href.length > 16000)
    throw Error(
      "This grid is too large for an editable link. Save an editable file instead.",
    );
  return u.href;
}
export function parseLink(href: string) {
  const u = new URL(href);
  if (
    href.length > 16000 ||
    !linkOpensTool(u, "expanding-factorising") ||
    !/^#algebra-grid=[A-Za-z0-9_-]+$/.test(u.hash)
  )
    throw Error(
      "This algebra-grid link could not be read. Open an editable file instead.",
    );
  const binary = atob(
    u.hash.slice(14).replaceAll("-", "+").replaceAll("_", "/"),
  );
  return parseFile(
    new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    ),
  );
}

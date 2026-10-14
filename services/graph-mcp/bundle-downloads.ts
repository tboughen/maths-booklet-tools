import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { GraphError } from "../../packages/graph-core/src/interchange";
import { diagramSource, diagramSourceSchema, type DiagramSource } from "./diagram-source";
const tokenSchema = z.object({
  kind: z.literal("diagram-bundle"), key: z.string().max(32), expires: z.number().int(),
  source: diagramSourceSchema,
}).strict();
const MAX_URL = 7500;
export class BundleDownloads {
  constructor(private base: string, private keys: Record<string, string>, private active: string) {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(active) || !Object.hasOwn(keys, active) || Object.values(keys).some((k) => typeof k !== "string" || k.length < 32))
      throw Error("Use a valid active bundle signing key of at least 32 characters.");
  }
  private signature(token: string, key: string) { return createHmac("sha256", key).update(token).digest("base64url"); }
  link(source: DiagramSource, now = Date.now()) {
    const expires = Math.floor(now / 1000) + 7 * 86400;
    const token = Buffer.from(JSON.stringify({ kind: "diagram-bundle", key: this.active, expires, source })).toString("base64url");
    const url = new URL("/diagram-bundle/download", this.base);
    url.searchParams.set("token", token);
    url.searchParams.set("signature", this.signature(token, this.keys[this.active]));
    if (url.href.length > MAX_URL) throw new GraphError("size_limit", "The bundle URL is too long; use bounded inline content or individual downloads.");
    return { url: url.href, expiresAt: new Date(expires * 1000).toISOString() };
  }
  verify(url: URL, now = Date.now()): DiagramSource {
    const token = url.searchParams.get("token") ?? "", signature = url.searchParams.get("signature") ?? "";
    if (token.length > MAX_URL || !/^[-_A-Za-z0-9]+$/.test(token) || !/^[-_A-Za-z0-9]{43}$/.test(signature))
      throw new GraphError("invalid_download", "Invalid bundle download.");
    let parsed: z.infer<typeof tokenSchema>;
    try { parsed = tokenSchema.parse(JSON.parse(Buffer.from(token, "base64url").toString("utf8"))); }
    catch { throw new GraphError("invalid_download", "Invalid bundle token."); }
    const key = Object.hasOwn(this.keys, parsed.key) ? this.keys[parsed.key] : undefined;
    if (!key || !timingSafeEqual(Buffer.from(signature), Buffer.from(this.signature(token, key))))
      throw new GraphError("invalid_download", "Invalid bundle signature.");
    if (parsed.expires <= Math.floor(now / 1000)) throw new GraphError("expired_download", "This bundle link expired. Call download_diagram_bundle with the saved envelope to refresh it.");
    return diagramSource(parsed.source);
  }
}

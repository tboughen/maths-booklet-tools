import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { GraphError } from "../../packages/graph-core/src/interchange";
import {
  diagramSource,
  diagramSourceSchema,
  type DiagramSource,
} from "./diagram-source";
import type { DownloadFormat } from "./downloads";
const tokenSchema = z
  .object({
    v: z.literal(1),
    key: z.string().max(32),
    expires: z.number().int(),
    format: z.enum(["svg", "png", "json"]),
    source: diagramSourceSchema,
  })
  .strict();
export class ResourceDownloads {
  constructor(
    private base: string,
    private keys: Record<string, string>,
    private active: string,
  ) {
    if (
      !/^[A-Za-z0-9_-]{1,32}$/.test(active) ||
      !Object.hasOwn(keys, active) ||
      Object.values(keys).some((k) => typeof k !== "string" || k.length < 32)
    )
      throw Error(
        "Use a valid active resource signing key of at least 32 characters.",
      );
  }
  private signature(token: string, key: string) {
    return createHmac("sha256", key).update(token).digest("base64url");
  }
  link(source: DiagramSource, format: DownloadFormat, now = Date.now()) {
    const expires = Math.floor(now / 1000) + 7 * 86400;
    const token = Buffer.from(
      JSON.stringify({ v: 1, key: this.active, expires, format, source }),
    ).toString("base64url");
    const url = new URL("/resource/download", this.base);
    url.searchParams.set("token", token);
    url.searchParams.set(
      "signature",
      this.signature(token, this.keys[this.active]),
    );
    if (url.href.length > 7500)
      throw new GraphError(
        "size_limit",
        "The resource link exceeds its limit; use the included file.",
      );
    return { url: url.href, expiresAt: new Date(expires * 1000).toISOString() };
  }
  verify(url: URL, now = Date.now()) {
    const token = url.searchParams.get("token") ?? "",
      signature = url.searchParams.get("signature") ?? "";
    if (
      token.length > 7500 ||
      !/^[-_A-Za-z0-9]+$/.test(token) ||
      !/^[-_A-Za-z0-9]{43}$/.test(signature)
    )
      throw new GraphError("invalid_download", "Invalid resource download.");
    let parsed: z.infer<typeof tokenSchema>;
    try {
      parsed = tokenSchema.parse(
        JSON.parse(Buffer.from(token, "base64url").toString("utf8")),
      );
    } catch {
      throw new GraphError("invalid_download", "Invalid resource token.");
    }
    const key = Object.hasOwn(this.keys, parsed.key)
      ? this.keys[parsed.key]
      : undefined;
    if (
      !key ||
      !timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(this.signature(token, key)),
      )
    )
      throw new GraphError("invalid_download", "Invalid resource signature.");
    if (parsed.expires <= Math.floor(now / 1000))
      throw new GraphError(
        "expired_download",
        "This download expired. Revise the saved source with no operations to refresh it.",
      );
    return { source: diagramSource(parsed.source), format: parsed.format };
  }
}

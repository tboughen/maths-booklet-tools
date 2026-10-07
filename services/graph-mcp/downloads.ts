import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  decodeEnvelope,
  encodeEnvelope,
  GraphError,
  MAX_LINK_LENGTH,
  validateEnvelope,
} from "../../packages/graph-core/src/interchange";
import type { GraphEnvelope } from "../../packages/graph-core/src/interchange";
const tokenSchema = z
  .object({
    v: z.literal(1),
    key: z.string().max(32),
    format: z.enum(["svg", "png", "json"]),
    expires: z.number().int(),
    graph: z.string().max(MAX_LINK_LENGTH),
  })
  .strict();
export type DownloadFormat = z.infer<typeof tokenSchema>["format"];
export class Downloads {
  constructor(
    private base: string,
    private keys: Record<string, string>,
    private activeKey: string,
  ) {
    if (
      !/^[a-zA-Z0-9_-]{1,32}$/.test(activeKey) ||
      !Object.hasOwn(keys, activeKey) ||
      !keys[activeKey] ||
      Object.values(keys).some((k) => typeof k !== "string" || k.length < 32)
    )
      throw Error(
        "Download signing keys must have at least 32 characters and a valid active key ID.",
      );
  }
  private signature(token: string, key: string) {
    return createHmac("sha256", key).update(token).digest("base64url");
  }
  link(
    envelope: GraphEnvelope,
    format: DownloadFormat,
    now = Date.now(),
  ): { url: string; expiresAt: string } {
    const expires = Math.floor(now / 1000) + 7 * 24 * 60 * 60;
    const token = Buffer.from(
      JSON.stringify({
        v: 1,
        key: this.activeKey,
        format,
        expires,
        graph: encodeEnvelope(envelope),
      }),
    ).toString("base64url");
    const url = new URL("/download", this.base);
    url.searchParams.set("token", token);
    url.searchParams.set(
      "signature",
      this.signature(token, this.keys[this.activeKey]),
    );
    if (url.href.length > MAX_LINK_LENGTH)
      throw new GraphError(
        "size_limit",
        "The download link is too long. Use the inline file content instead.",
      );
    return { url: url.href, expiresAt: new Date(expires * 1000).toISOString() };
  }
  verify(
    url: URL,
    now = Date.now(),
  ): { envelope: GraphEnvelope; format: DownloadFormat } {
    const token = url.searchParams.get("token") ?? "",
      signature = url.searchParams.get("signature") ?? "";
    if (
      token.length > MAX_LINK_LENGTH ||
      !/^[A-Za-z0-9_-]+$/.test(token) ||
      !/^[A-Za-z0-9_-]{43}$/.test(signature)
    )
      throw new GraphError("invalid_download", "The download link is invalid.");
    let parsed: ReturnType<typeof tokenSchema.parse>;
    try {
      parsed = tokenSchema.parse(
        JSON.parse(Buffer.from(token, "base64url").toString("utf8")),
      );
    } catch {
      throw new GraphError("invalid_download", "The download link is invalid.");
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
      throw new GraphError(
        "invalid_download",
        "The download signature is invalid.",
      );
    if (parsed.expires <= Math.floor(now / 1000))
      throw new GraphError(
        "expired_download",
        "This download link has expired. Re-render the saved graph to refresh it.",
      );
    return {
      envelope: validateEnvelope(decodeEnvelope(parsed.graph), true),
      format: parsed.format,
    };
  }
}

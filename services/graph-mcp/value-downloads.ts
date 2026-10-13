import { createHmac, timingSafeEqual } from "node:crypto";
import {
  encode,
  decode,
  type ValueEnvelope,
} from "../../packages/value-graph-core/src/interchange";
import { GraphError } from "../../packages/graph-core/src/interchange";
import type { DownloadFormat } from "./downloads";
import { z } from "zod";
const tokenSchema = z
  .object({
    kind: z.literal("value-graph"),
    key: z.string().max(32),
    format: z.enum(["svg", "png", "json"]),
    expires: z.number().int(),
    values: z.string().max(16000),
  })
  .strict();
export class ValueDownloads {
  constructor(
    private base: string,
    private keys: Record<string, string>,
    private active: string,
  ) {
    if (
      !/^[A-Za-z0-9_-]{1,32}$/.test(active) ||
      !Object.hasOwn(keys, active) ||
      Object.values(keys).some((k) => k.length < 32)
    )
      throw Error(
        "Use a valid active download key and signing keys of at least 32 characters.",
      );
  }
  private signature(token: string, key: string) {
    return createHmac("sha256", key).update(token).digest("base64url");
  }
  link(envelope: ValueEnvelope, format: DownloadFormat, now = Date.now()) {
    const expires = Math.floor(now / 1000) + 7 * 86400,
      token = Buffer.from(
        JSON.stringify({
          kind: "value-graph",
          key: this.active,
          format,
          expires,
          values: encode(envelope),
        }),
      ).toString("base64url"),
      url = new URL("/value-graph/download", this.base);
    url.searchParams.set("token", token);
    url.searchParams.set(
      "signature",
      this.signature(token, this.keys[this.active]),
    );
    if (url.href.length > 7500)
      throw new GraphError(
        "size_limit",
        "This download link is too large; use the included file.",
      );
    return { url: url.href, expiresAt: new Date(expires * 1000).toISOString() };
  }
  verify(
    url: URL,
    now = Date.now(),
  ): { envelope: ValueEnvelope; format: DownloadFormat } {
    const token = url.searchParams.get("token") ?? "",
      signature = url.searchParams.get("signature") ?? "";
    if (
      token.length > 7500 ||
      !/^[-_A-Za-z0-9]+$/.test(token) ||
      !/^[-_A-Za-z0-9]{43}$/.test(signature)
    )
      throw new GraphError("invalid_download", "Invalid value-graph download.");
    let value: z.infer<typeof tokenSchema>;
    try {
      value = tokenSchema.parse(
        JSON.parse(Buffer.from(token, "base64url").toString("utf8")),
      );
    } catch {
      throw new GraphError("invalid_download", "Invalid value-graph token.");
    }
    const key = Object.hasOwn(this.keys, value.key)
      ? this.keys[value.key]
      : undefined;
    if (
      !key ||
      !timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(this.signature(token, key)),
      )
    )
      throw new GraphError("invalid_download", "Invalid download signature.");
    if (value.expires <= Math.floor(now / 1000))
      throw new GraphError(
        "expired_download",
        "This download expired. Revise the saved envelope with no operations to refresh it.",
      );
    return { envelope: decode(value.values), format: value.format };
  }
}

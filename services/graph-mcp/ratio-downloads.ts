import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  encodeRatio,
  decodeRatio,
  RatioError,
  RATIO_MAX_LINK_LENGTH,
} from "../../packages/ratio-table-core/src/interchange";
import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";
import type { DownloadFormat } from "./downloads";

const tokenSchema = z
  .object({
    v: z.literal(1),
    kind: z.literal("ratio-table"),
    key: z.string().max(32),
    format: z.enum(["svg", "png", "json"]),
    expires: z.number().int(),
    ratio: z.string().max(RATIO_MAX_LINK_LENGTH),
  })
  .strict();
export class RatioDownloads {
  constructor(
    private base: string,
    private keys: Record<string, string>,
    private activeKey: string,
  ) {
    if (
      !/^[a-zA-Z0-9_-]{1,32}$/.test(activeKey) ||
      !Object.hasOwn(keys, activeKey) ||
      !keys[activeKey] ||
      Object.values(keys).some(
        (key) => typeof key !== "string" || key.length < 32,
      )
    )
      throw Error(
        "Download signing keys must have at least 32 characters and a valid active key ID.",
      );
  }
  private signature(token: string, key: string) {
    return createHmac("sha256", key).update(token).digest("base64url");
  }
  link(envelope: RatioEnvelope, format: DownloadFormat, now = Date.now()) {
    const expires = Math.floor(now / 1000) + 7 * 24 * 60 * 60;
    const token = Buffer.from(
      JSON.stringify({
        v: 1,
        kind: "ratio-table",
        key: this.activeKey,
        format,
        expires,
        ratio: encodeRatio(envelope),
      }),
    ).toString("base64url");
    const url = new URL("/ratio-table/download", this.base);
    url.searchParams.set("token", token);
    url.searchParams.set(
      "signature",
      this.signature(token, this.keys[this.activeKey]),
    );
    if (url.href.length > RATIO_MAX_LINK_LENGTH)
      throw new RatioError(
        "size_limit",
        "The download link is too long. Use the included file content instead.",
      );
    return { url: url.href, expiresAt: new Date(expires * 1000).toISOString() };
  }
  verify(
    url: URL,
    now = Date.now(),
  ): { envelope: RatioEnvelope; format: DownloadFormat } {
    const token = url.searchParams.get("token") ?? "",
      signature = url.searchParams.get("signature") ?? "";
    if (
      token.length > RATIO_MAX_LINK_LENGTH ||
      !/^[A-Za-z0-9_-]+$/.test(token) ||
      !/^[A-Za-z0-9_-]{43}$/.test(signature)
    )
      throw new RatioError(
        "invalid_download",
        "The ratio-table download link is invalid.",
      );
    let parsed: z.infer<typeof tokenSchema>;
    try {
      parsed = tokenSchema.parse(
        JSON.parse(Buffer.from(token, "base64url").toString("utf8")),
      );
    } catch {
      throw new RatioError(
        "invalid_download",
        "The ratio-table download link is invalid.",
      );
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
      throw new RatioError(
        "invalid_download",
        "The download signature is invalid.",
      );
    if (parsed.expires <= Math.floor(now / 1000))
      throw new RatioError(
        "expired_download",
        "This download expired. Revise the saved table with no operations to refresh it.",
      );
    return { envelope: decodeRatio(parsed.ratio), format: parsed.format };
  }
}

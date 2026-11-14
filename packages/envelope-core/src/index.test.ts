// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CONTENT_HASH, defineEnvelope, fromBase64Url, sha256Hex, sortedJson, toBase64Url } from "./index";

describe("envelope-core", () => {
  it("hashes UTF-8 text exactly as Node's SHA-256 does", async () => {
    for (const text of ["", "abc", "x² − ½ × π ≤ 3", JSON.stringify({ a: [1, "2/3"] })]) {
      const hash = await sha256Hex(text);
      expect(hash).toBe(createHash("sha256").update(text, "utf8").digest("hex"));
      expect(hash).toMatch(CONTENT_HASH);
    }
  });

  it("writes sorted canonical JSON at every level and keeps array order", () => {
    expect(sortedJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null }, e: undefined })).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
    expect(sortedJson({ b: 1, a: 2 })).toBe(sortedJson({ a: 2, b: 1 }));
    expect(() => sortedJson({ a: Number.NaN })).toThrow(/non-finite/);
  });

  it("round-trips base64url link payloads, including non-ASCII maths", () => {
    for (const text of ["", "{}", "−3 ≤ y < 4", "½ ¾ ξ", "a".repeat(1000)]) {
      const token = toBase64Url(text);
      expect(token).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(fromBase64Url(token)).toBe(text);
      expect(token).toBe(Buffer.from(text, "utf8").toString("base64url"));
    }
    expect(() => fromBase64Url("not base64!")).toThrow(/Invalid editable link/);
    expect(() => fromBase64Url("a".repeat(20), 10)).toThrow(/Invalid editable link/);
  });

  it("defines a family's canonical, hash and links from its validator", async () => {
    type E = { kind: "demo"; b: number; a: number };
    const validate = (raw: unknown): E => {
      const r = raw as E;
      if (r?.kind !== "demo") throw Error("Not a demo envelope.");
      return { kind: "demo", b: r.b, a: r.a };
    };
    const schemaOrder = defineEnvelope<E>({ kind: "demo", validate, canonical: "schema-order" });
    const sorted = defineEnvelope<E>({ kind: "demo", validate, canonical: "sorted" });
    const e = { a: 1, b: 2, kind: "demo" } as E;
    expect(schemaOrder.canonical(e)).toBe('{"kind":"demo","b":2,"a":1}');
    expect(sorted.canonical(e)).toBe('{"a":1,"b":2,"kind":"demo"}');
    expect(await schemaOrder.contentHash(e)).toBe(await sha256Hex('{"kind":"demo","b":2,"a":1}'));
    expect(schemaOrder.decodeLink(schemaOrder.encodeLink(e))).toEqual(validate(e));
    expect(() => schemaOrder.decodeLink(toBase64Url('{"kind":"other"}'))).toThrow(/Not a demo/);
  });
});

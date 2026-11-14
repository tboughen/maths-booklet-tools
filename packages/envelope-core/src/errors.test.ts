// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MathsDockError, toErrorBody } from "./errors";

const defaults = { code: "invalid_diagram", message: "The diagram could not be processed.", fieldHint: "Check the schema." };

describe("toErrorBody", () => {
  it("turns a zod error into invalid_input with dotted field paths", () => {
    const r = z.object({ spec: z.object({ n: z.number() }) }).safeParse({ spec: { n: "x" } });
    const body = toErrorBody(r.error, { ...defaults, pathPrefix: ["resource"] });
    expect(body).toMatchObject({ code: "invalid_input", fields: [{ path: "resource.spec.n" }], hint: "Check the schema.", retry: "fix_input" });
    expect(body.message).toMatch(/^resource\.spec\.n: /);
  });
  it("keeps a coded error's code, fields and hint", () => {
    const e = new MathsDockError("label_clash", "Labels B and C overlap.", { fields: [{ path: "document.labels.1", message: "overlaps label C" }], hint: "Widen the tree." });
    expect(toErrorBody(e, defaults)).toEqual({ code: "label_clash", message: "Labels B and C overlap.", fields: [{ path: "document.labels.1", message: "overlaps label C" }], hint: "Widen the tree.", retry: "fix_input" });
  });
  it("reads every older stale-hash spelling as stale_hash", () => {
    for (const m of ["stale_hash: use the exact returned envelope and contentHash.", "base_hash_mismatch: Use the exact returned envelope and contentHash.", "The baseHash does not match this definition. Use the last returned envelope and hash."]) {
      const body = toErrorBody(new Error(m), defaults);
      expect(body.code, m).toBe("stale_hash");
      expect(body.retry).toBe("refresh_envelope");
      expect(body.message).not.toMatch(/^(stale_hash|base_hash_mismatch):/);
    }
  });
  it("uses the default code for a plain error and never leaks a non-Error", () => {
    expect(toErrorBody(new Error("Each data set needs exactly one value."), defaults)).toEqual({ code: "invalid_diagram", message: "Each data set needs exactly one value.", retry: "fix_input" });
    expect(toErrorBody({ secret: 1 }, defaults)).toEqual({ code: "invalid_diagram", message: defaults.message, retry: "fix_input" });
  });
  it("reads only known codes from a message prefix, and stale wording only where cores use it", () => {
    for (const m of ["arx: must be a positive number", "discriminator: expected one of point, line", "objects: too many lines"]) {
      expect(toErrorBody(new Error(m), defaults), m).toEqual({ code: "invalid_diagram", message: m, retry: "fix_input" });
    }
    expect(toErrorBody(new Error("Labels mention stale_hash and base_hash_mismatch."), defaults).code).toBe("invalid_diagram");
    expect(toErrorBody(new Error("The base hash is stale."), defaults).code).toBe("stale_hash");
  });
  it("hides an uncoded runtime error's text where the tool asks for it", () => {
    const opaque = { ...defaults, opaque: true };
    expect(toErrorBody(new Error("ENOENT: /srv/cache/x.png"), opaque)).toEqual({ code: "invalid_diagram", message: defaults.message, retry: "fix_input" });
    expect(toErrorBody(new MathsDockError("too_wide", "The diagram is wider than the page."), opaque).message).toBe("The diagram is wider than the page.");
    expect(toErrorBody(new Error("stale_hash: use the returned envelope."), opaque).code).toBe("stale_hash");
  });
  it("marks temporary limits as try_later", () => {
    expect(toErrorBody(new MathsDockError("rate_limited", "Today's allowance has been reached."), defaults).retry).toBe("try_later");
    expect(toErrorBody(new MathsDockError("busy", "The renderer is busy."), defaults).retry).toBe("try_later");
  });
});

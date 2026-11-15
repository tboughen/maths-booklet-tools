// @vitest-environment node
/**
 * M19: one source of truth for renderer versions. Each core exports its RENDERER_VERSION; schemas,
 * new envelopes, the connector's capabilities and its health check all read that constant, so a
 * version bump is one edit. This test fails if a version is typed out anywhere else.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { DIAGRAM_KINDS, FAMILIES } from "./registry";
import { familyCapabilities } from "./guides";

const root = join(__dirname, "../../..");
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === "fixtures") return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("renderer versions (M19)", () => {
  it.each([...DIAGRAM_KINDS])("%s: a new envelope's version is the one the capabilities advertise", (kind) => {
    const envelope = FAMILIES[kind].create(kind === "graph" ? { spec: { objects: [] } } : {}) as { rendererVersion: string };
    const caps = familyCapabilities(kind) as { rendererVersion?: string; rendererVersions?: string[] };
    expect(caps.rendererVersions ?? [caps.rendererVersion]).toContain(envelope.rendererVersion);
  });

  it("no source types a renderer version outside its core's RENDERER_VERSION", () => {
    // Any field or comparison named *RendererVersion(s) given a typed "family-N" value, e.g.
    // rendererVersion: "venn-2", defaultRendererVersion: "venn-2", z.literal("venn-2"), x.rendererVersion === "venn-2".
    const typed = /rendererversions?\s*(:|===?|!==?)\s*(z\.literal\(\s*)?\[?[^\]\n]*["'][a-z][a-z0-9-]*-\d+["']/i;
    const offenders = [join(root, "packages"), join(root, "services/graph-mcp"), join(root, "src")]
      .flatMap(sources)
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .map((line, i) => ({ line, at: `${relative(root, file)}:${i + 1}` }))
          .filter(({ line }) => typed.test(line))
          .map(({ at }) => at),
      );
    expect(offenders).toEqual([]);
  });
});

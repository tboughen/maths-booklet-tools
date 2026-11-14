// U57: the print fonts are fetched once, and can start loading on export intent before the click.
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("print font preload", () => {
  it("fetches the fonts and subsetter once; the first export reuses them", async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([0, 1, 0, 0])));
    vi.stubGlobal("fetch", fetch);
    const { preloadPortableFonts, embedPortableFonts } = await import("./portable");
    preloadPortableFonts();
    preloadPortableFonts();
    // Three STIX fonts and the subsetter, started by the preload alone.
    expect(fetch).toHaveBeenCalledTimes(4);
    const svg = await embedPortableFonts('<svg xmlns="http://www.w3.org/2000/svg"><text>2</text></svg>');
    expect(svg).toContain("@font-face");
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("forgets a failed preload, so the export tries again and reports its own error", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const { preloadPortableFonts, embedPortableFonts } = await import("./portable");
    preloadPortableFonts();
    await new Promise((r) => setTimeout(r, 0));
    await expect(embedPortableFonts("<svg></svg>")).rejects.toThrow(/print font could not be loaded/);
    expect(fetch.mock.calls.length).toBeGreaterThan(4);
  });
});

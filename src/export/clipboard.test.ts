import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloneDefaultDocument } from "../domain/diagram";
import { copyDiagram } from "./clipboard";

vi.mock("./png", () => ({
  renderDiagramPng: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
}));

describe("Word clipboard export", () => {
  let representations: Record<string, Blob> | undefined;
  const write = vi.fn(async () => undefined);

  beforeEach(() => {
    representations = undefined;
    write.mockClear();
    class MockClipboardItem {
      constructor(items: Record<string, Blob>) {
        representations = items;
      }
    }
    vi.stubGlobal("ClipboardItem", MockClipboardItem);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write },
    });
  });

  it("offers Word one consistent 600 ppi PNG through image and HTML representations", async () => {
    await copyDiagram(cloneDefaultDocument());

    expect(write).toHaveBeenCalledOnce();
    expect(Object.keys(representations ?? {})).toEqual(["image/png", "text/html"]);
    expect(representations).not.toHaveProperty("image/svg+xml");
    expect(representations?.["image/png"].type).toBe("image/png");
    expect(representations?.["text/html"].type).toBe("text/html");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloneDefaultDocument } from "../domain/diagram";
import { copyDiagram } from "./clipboard";

const pngMocks = vi.hoisted(() => ({
  renderDiagramPng: vi.fn(),
  assertPrintReadyPng: vi.fn(),
}));

vi.mock("./png", () => ({
  renderDiagramPng: pngMocks.renderDiagramPng,
  assertPrintReadyPng: pngMocks.assertPrintReadyPng,
}));

describe("Word clipboard export", () => {
  let representations: Record<string, Blob> | undefined;
  const write = vi.fn(async () => undefined);

  beforeEach(() => {
    representations = undefined;
    write.mockReset();
    write.mockResolvedValue(undefined);
    pngMocks.renderDiagramPng.mockReset();
    pngMocks.renderDiagramPng.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    pngMocks.assertPrintReadyPng.mockReset();
    pngMocks.assertPrintReadyPng.mockResolvedValue(undefined);
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

  it("offers Word only the verified 600 ppi PNG", async () => {
    await copyDiagram(cloneDefaultDocument());

    expect(write).toHaveBeenCalledOnce();
    expect(pngMocks.assertPrintReadyPng).toHaveBeenCalledWith(expect.any(Blob), 11.7, 11.55);
    expect(Object.keys(representations ?? {})).toEqual(["image/png"]);
    expect(representations).not.toHaveProperty("text/html");
    expect(representations).not.toHaveProperty("image/svg+xml");
    expect(representations?.["image/png"].type).toBe("image/png");
  });

  it("does not write an image that fails print-quality validation", async () => {
    pngMocks.assertPrintReadyPng.mockRejectedValueOnce(new Error("The print-quality PNG could not be verified."));

    await expect(copyDiagram(cloneDefaultDocument())).rejects.toThrow("print-quality PNG could not be verified");
    expect(write).not.toHaveBeenCalled();
  });

  it("reports the PNG download when the browser blocks clipboard access", async () => {
    write.mockRejectedValueOnce(new DOMException("Not allowed", "NotAllowedError"));

    await expect(copyDiagram(cloneDefaultDocument())).rejects.toThrow("Use Download PNG (600 ppi) instead");
    expect(write).toHaveBeenCalledOnce();
  });
});

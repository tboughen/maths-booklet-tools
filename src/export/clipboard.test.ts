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
  let copiedHtml: string | undefined;
  let clipboardItemConstructed: boolean;
  const write = vi.fn(async () => undefined);
  const execCommand = vi.fn(() => true);

  beforeEach(() => {
    copiedHtml = undefined;
    clipboardItemConstructed = false;
    write.mockReset();
    write.mockResolvedValue(undefined);
    execCommand.mockReset();
    execCommand.mockImplementation(() => {
      copiedHtml = document.querySelector<HTMLElement>('div[aria-hidden="true"]')?.innerHTML;
      return true;
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    pngMocks.renderDiagramPng.mockReset();
    pngMocks.renderDiagramPng.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    pngMocks.assertPrintReadyPng.mockReset();
    pngMocks.assertPrintReadyPng.mockResolvedValue(undefined);
    class MockClipboardItem {
      constructor() {
        clipboardItemConstructed = true;
      }
    }
    vi.stubGlobal("ClipboardItem", MockClipboardItem);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write },
    });
  });

  it("copies the verified PNG through a Word-sized native webpage selection", async () => {
    await copyDiagram(cloneDefaultDocument());

    expect(execCommand).toHaveBeenCalledOnce();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(write).not.toHaveBeenCalled();
    expect(clipboardItemConstructed).toBe(false);
    expect(pngMocks.assertPrintReadyPng).toHaveBeenCalledWith(expect.any(Blob), 11.24, 11.12);
    expect(copiedHtml).toContain('src="data:image/png;base64,cG5n"');
    expect(copiedHtml).toContain('style="width:11.24cm;height:11.12cm"');
    expect(copiedHtml).toContain('width="11.24cm"');
    expect(copiedHtml).toContain('height="11.12cm"');
    expect(document.querySelector('div[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it("directs teachers to the PNG download instead of copying a wrongly sized raw clipboard image", async () => {
    execCommand.mockReturnValueOnce(false);

    await expect(copyDiagram(cloneDefaultDocument())).rejects.toThrow("Use Download PNG (600 ppi) instead");

    expect(write).not.toHaveBeenCalled();
    expect(clipboardItemConstructed).toBe(false);
  });

  it("uses native webpage copying without requiring the Async Clipboard API", async () => {
    vi.stubGlobal("ClipboardItem", undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });

    await expect(copyDiagram(cloneDefaultDocument())).resolves.toBeUndefined();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(write).not.toHaveBeenCalled();
  });

  it("does not write an image that fails print-quality validation", async () => {
    pngMocks.assertPrintReadyPng.mockRejectedValueOnce(new Error("The print-quality PNG could not be verified."));

    await expect(copyDiagram(cloneDefaultDocument())).rejects.toThrow("print-quality PNG could not be verified");
    expect(execCommand).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("reports the PNG download when the browser blocks clipboard access", async () => {
    execCommand.mockImplementationOnce(() => {
      throw new DOMException("Not allowed", "NotAllowedError");
    });

    await expect(copyDiagram(cloneDefaultDocument())).rejects.toThrow("Use Download PNG (600 ppi) instead");
    expect(write).not.toHaveBeenCalled();
  });
});

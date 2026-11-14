import { describe, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { strFromU8, unzipSync } from "fflate";
import { bothCopiesZip } from "./bothCopies";

vi.mock("./clipboard", () => ({ downloadBlob: () => undefined }));

describe("pupil and answers copies in one ZIP (U28)", () => {
  vi.stubGlobal("Blob", NodeBlob);
  it("names each copy with the shared rule and keeps the pupil files free of answers", async () => {
    const seen: string[] = [];
    const zip = await bothCopiesZip("charts", { title: "Travel to school" }, async (view) => {
      seen.push(view);
      return { svg: `<svg>${view}</svg>`, png: new NodeBlob([view === "answer" ? "A" : "P"]) as unknown as Blob };
    });
    expect(seen).toEqual(["pupil", "answer"]);
    const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    const names = Object.keys(files);
    expect(names).toHaveLength(4);
    expect(names.every((n) => n.startsWith("mathsdock-charts-travel-to-school-"))).toBe(true);
    const answers = names.filter((n) => n.includes("-answers-"));
    expect(answers.map((n) => n.split(".").pop()).sort()).toEqual(["png", "svg"]);
    for (const n of names) expect(strFromU8(files[n]).includes("answer") || strFromU8(files[n]) === "A").toBe(n.includes("-answers-"));
  });
});

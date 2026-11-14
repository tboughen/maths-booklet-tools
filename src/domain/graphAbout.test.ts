import { describe, expect, it } from "vitest";
import { createEnvelope } from "../../packages/graph-core/src/interchange";
import { newBrowserGraph } from "./browserGraph";
import { graphDocument, graphEnvelope, withGraphAbout } from "./graphAbout";

describe("the graph editor keeps worked notes (U116)", () => {
  const worked = [{ text: "Read across from 4", x: 2, y: 2 }];
  it("through opening and saving, and when only the title changes", () => {
    const saved = { ...createEnvelope(newBrowserGraph()), worked };
    const opened = graphDocument(saved);
    expect(graphEnvelope(opened)).toMatchObject({ worked });
    const titled = withGraphAbout(opened, { title: "Straight lines" });
    expect(graphEnvelope(titled)).toMatchObject({ worked, title: "Straight lines" });
    expect(graphEnvelope(withGraphAbout(titled, {}))).toMatchObject({ worked });
  });
});

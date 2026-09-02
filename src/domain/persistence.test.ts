import { beforeEach, describe, expect, it } from "vitest";
import { cloneDefaultDocument, STORAGE_KEY } from "./diagram";
import { isDiagramDocument, loadDiagram, saveDiagram } from "./persistence";

describe("local diagram recovery", () => {
  beforeEach(() => localStorage.clear());

  it("saves and restores a valid multi-object diagram", () => {
    const document = {
      ...cloneDefaultDocument(),
      objects: [
        { id: "point-1", kind: "point" as const, position: { x: 1, y: 2 } },
        {
          id: "straight-1",
          kind: "straight" as const,
          display: "line" as const,
          start: { x: -5, y: -4 },
          end: { x: 5, y: 4 },
          equationVisible: true,
        },
      ],
      selectedObjectId: "straight-1",
    };

    saveDiagram(document);
    expect(loadDiagram()).toEqual(document);
  });

  it("falls back safely when saved data is malformed", () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    expect(loadDiagram()).toEqual(cloneDefaultDocument());

    const invalid = { ...cloneDefaultDocument(), selectedObjectId: "missing" };
    expect(isDiagramDocument(invalid)).toBe(false);
  });

  it("rejects grids beyond the supported printable limits", () => {
    const invalid = cloneDefaultDocument();
    invalid.axes.x.positiveSquares = 100;
    expect(isDiagramDocument(invalid)).toBe(false);
  });
});

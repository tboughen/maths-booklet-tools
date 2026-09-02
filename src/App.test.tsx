import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { cloneDefaultDocument } from "./domain/diagram";
import { saveDiagram } from "./domain/persistence";

describe("graph builder", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("adds and independently changes multiple equation-defined lines", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText("0 objects")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Line by equation" }));
    await user.clear(screen.getByRole("textbox", { name: "Gradient m" }));
    await user.type(screen.getByRole("textbox", { name: "Gradient m" }), "2");
    await user.clear(screen.getByRole("textbox", { name: "Intercept c" }));
    await user.type(screen.getByRole("textbox", { name: "Intercept c" }), "1");
    await user.click(screen.getByRole("button", { name: "Add line" }));

    await user.click(screen.getByRole("button", { name: "Line by equation" }));
    await user.click(screen.getByRole("button", { name: "x = a" }));
    await user.clear(screen.getByRole("textbox", { name: "Value a" }));
    await user.type(screen.getByRole("textbox", { name: "Value a" }), "-2");
    await user.click(screen.getByRole("button", { name: "Add line" }));

    expect(screen.getByText("2 objects")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Point" }));
    await user.click(screen.getByRole("button", { name: /Objects/ }));
    const firstObject = screen.getByRole("button", { name: /Select Line 1/ });
    await user.click(firstObject);

    expect(firstObject).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(screen.getByRole("group", { name: "Object extent" })).getByRole("button", { name: "Segment" }));

    expect(screen.getByRole("button", { name: /Segment 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Line 2/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: /Line 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Line 2/ })).toBeInTheDocument();
  });

  it("shows a useful error for an invalid equation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Line by equation" }));
    await user.clear(screen.getByRole("textbox", { name: "Gradient m" }));
    await user.type(screen.getByRole("textbox", { name: "Gradient m" }), "not a number");
    await user.click(screen.getByRole("button", { name: "Add line" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter valid numbers or fractions");
    expect(screen.getByText("0 objects")).toBeInTheDocument();
  });

  it("keeps graph controls beyond the axis names and removes the diagram footer hint", () => {
    const { container } = render(<App />);
    const xName = container.querySelector<SVGTextElement>(".axis-name--x");
    const yName = container.querySelector<SVGTextElement>(".axis-name--y");
    const positiveXButton = screen.getByRole("button", { name: "Add one square at the positive end of the x-axis" });
    const positiveYButton = screen.getByRole("button", { name: "Add one square at the positive end of the y-axis" });
    const positiveXControl = positiveXButton.parentElement;
    const positiveYControl = positiveYButton.parentElement;
    const xNumber = [...container.querySelectorAll<SVGTextElement>(".axis-number text")]
      .find((label) => label.getAttribute("text-anchor") === "middle");
    const positiveXControlRect = positiveXButton.querySelector("rect");
    const originLabel = container.querySelector<SVGTextElement>(".axis-number--origin text");
    const plotRect = container.querySelector<SVGRectElement>("#editor-plot-clip rect");
    const xAxis = container.querySelector<SVGLineElement>(".graph-axes line:nth-child(1)");
    const yAxis = container.querySelector<SVGLineElement>(".graph-axes line:nth-child(2)");
    const xControlPosition = Number(positiveXControl?.getAttribute("transform")?.match(/translate\(([-\d.]+)/)?.[1]);
    const yControlPosition = Number(positiveYControl?.getAttribute("transform")?.match(/translate\([^ ]+ ([-\d.]+)/)?.[1]);

    expect(xName).not.toBeNull();
    expect(yName).not.toBeNull();
    expect(xName).toHaveTextContent("𝑥");
    expect(yName).toHaveTextContent("𝑦");
    expect(xName?.getAttribute("font-family")).toContain("Cambria Math");
    expect(yName?.getAttribute("font-family")).toContain("Cambria Math");
    expect(originLabel?.getAttribute("transform")).toContain("skewX(-12)");
    expect(Number(xAxis?.getAttribute("x2")) - (Number(plotRect?.getAttribute("x")) + Number(plotRect?.getAttribute("width")))).toBe(17);
    expect(Number(plotRect?.getAttribute("y")) - Number(yAxis?.getAttribute("y2"))).toBe(17);
    expect(Number(yAxis?.getAttribute("x1")) - Number(yName?.getAttribute("x"))).toBeCloseTo(7.2);
    expect(xName?.getAttribute("y")).toBe(xNumber?.getAttribute("y"));
    expect(positiveXControlRect).toHaveAttribute("width", "48");
    expect(positiveXControlRect).toHaveAttribute("height", "48");
    expect(xControlPosition).toBeGreaterThan(Number(xName?.getAttribute("x")));
    expect(yControlPosition).toBeLessThan(Number(yName?.getAttribute("y")));
    expect(screen.queryByText("Start with Point or Segment")).not.toBeInTheDocument();
    expect(screen.queryByText("Exports at 1 cm per grid square.")).not.toBeInTheDocument();
  });

  it("keeps controls clear of the origin when both axes are on the lower-left boundary", () => {
    const boundaryDocument = cloneDefaultDocument();
    boundaryDocument.axes.x.negativeSquares = 0;
    boundaryDocument.axes.y.negativeSquares = 0;
    boundaryDocument.axes.y.positiveSquares = 8;
    saveDiagram(boundaryDocument);
    const { container } = render(<App />);

    const negativeXControl = screen.getByRole("button", { name: "Add one square at the negative end of the x-axis" }).parentElement;
    const negativeYControl = screen.getByRole("button", { name: "Add one square at the negative end of the y-axis" }).parentElement;
    const originRect = container.querySelector<SVGRectElement>(".axis-number--origin rect");
    const position = (element: Element | null) => {
      const match = element?.getAttribute("transform")?.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
      return { x: Number(match?.[1]), y: Number(match?.[2]) };
    };
    const negativeX = position(negativeXControl);
    const negativeY = position(negativeYControl);
    const origin = {
      left: Number(originRect?.getAttribute("x")),
      top: Number(originRect?.getAttribute("y")),
      right: Number(originRect?.getAttribute("x")) + Number(originRect?.getAttribute("width")),
      bottom: Number(originRect?.getAttribute("y")) + Number(originRect?.getAttribute("height")),
    };

    expect(negativeX.x + 100).toBeLessThan(origin.left);
    expect(negativeY.y).toBeGreaterThan(origin.bottom);
    expect(negativeY.y).toBeGreaterThan(negativeX.y + 48);
  });

  it("gives point x and y coordinate inputs equal-width columns", () => {
    const pointDocument = cloneDefaultDocument();
    const point = { id: "point-1", kind: "point" as const, position: { x: -4, y: 2 } };
    pointDocument.objects = [point];
    pointDocument.selectedObjectId = point.id;
    saveDiagram(pointDocument);
    const { container } = render(<App />);

    const xInput = screen.getByRole("textbox", { name: "Point x" });
    const yInput = screen.getByRole("textbox", { name: "Point y" });
    const fields = xInput.closest(".coordinate-fields");

    expect(fields).toHaveClass("coordinate-fields--point");
    expect(fields).toContainElement(yInput);
    expect(container.querySelector(".object-kind-icon")).toBeNull();
  });

  it("applies dashed styling to one straight object without changing another", async () => {
    const user = userEvent.setup();
    const lineDocument = cloneDefaultDocument();
    lineDocument.objects = [
      {
        id: "straight-1",
        kind: "straight",
        display: "line",
        start: { x: -5, y: -4 },
        end: { x: 5, y: 4 },
        equationVisible: false,
      },
      {
        id: "straight-2",
        kind: "straight",
        display: "segment",
        start: { x: -3, y: 2 },
        end: { x: 3, y: 2 },
        equationVisible: false,
      },
    ];
    lineDocument.selectedObjectId = "straight-1";
    saveDiagram(lineDocument);
    const { container } = render(<App />);

    const styleControls = within(screen.getByRole("group", { name: "Line style" }));
    await user.click(styleControls.getByRole("button", { name: "Dashed" }));
    const lines = container.querySelectorAll<SVGLineElement>(".graph-straight");

    expect(styleControls.getByRole("button", { name: "Dashed" })).toHaveAttribute("aria-pressed", "true");
    expect(lines[0]).toHaveAttribute("stroke-dasharray", "10.8 7.2");
    expect(lines[1]).not.toHaveAttribute("stroke-dasharray");
    expect(container.querySelector(".object-kind-icon")).toBeNull();
  });

  it("resets the whole diagram from the toolbar and keeps the action undoable", async () => {
    const user = userEvent.setup();
    const changedDocument = cloneDefaultDocument();
    changedDocument.axes.x.positiveSquares = 7;
    changedDocument.objects = [{ id: "point-1", kind: "point", position: { x: 2, y: 3 } }];
    changedDocument.selectedObjectId = "point-1";
    saveDiagram(changedDocument);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Reset diagram" }));

    expect(confirm).toHaveBeenCalledWith("Reset the diagram? This clears the grid settings and all objects. You can undo this action afterwards.");
    expect(screen.getByText("0 objects")).toBeInTheDocument();
    expect(screen.getByText("Nothing selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("1 object")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Point x" })).toHaveValue("2");
  });

  it("shows the one-time Windows Word quality setup without interrupting the main workflow", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Download options" }));
    await user.click(screen.getByRole("menuitem", { name: /First-time Word setup/ }));

    const dialog = screen.getByRole("dialog", { name: "Keep full image quality in Word" });
    expect(dialog).toHaveTextContent("File › Options › Advanced");
    expect(dialog).toHaveTextContent("Do not compress images in file");
    expect(dialog).toHaveTextContent("High fidelity");
    expect(within(dialog).getByRole("link", { name: /change image resolution/ })).toHaveAttribute("href", expect.stringContaining("support.microsoft.com"));

    await user.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the 600 ppi PNG fallback when clipboard images are unavailable", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    vi.stubGlobal("ClipboardItem", undefined);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Copy for Word" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Use Download PNG (600 ppi) instead");
    expect(screen.getByRole("menuitem", { name: /Download PNG/ })).toBeInTheDocument();
  });
});

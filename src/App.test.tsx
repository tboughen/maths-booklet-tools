import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("graph builder", () => {
  beforeEach(() => localStorage.clear());

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
    await user.click(screen.getByRole("button", { name: /Objects/ }));
    await user.click(screen.getByRole("button", { name: /Line 1/ }));
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
    const xControlPosition = Number(positiveXControl?.getAttribute("transform")?.match(/translate\(([-\d.]+)/)?.[1]);
    const yControlPosition = Number(positiveYControl?.getAttribute("transform")?.match(/translate\([^ ]+ ([-\d.]+)/)?.[1]);

    expect(xName).not.toBeNull();
    expect(yName).not.toBeNull();
    expect(xControlPosition).toBeGreaterThan(Number(xName?.getAttribute("x")));
    expect(yControlPosition).toBeLessThan(Number(yName?.getAttribute("y")));
    expect(screen.queryByText("Start with Point or Segment")).not.toBeInTheDocument();
    expect(screen.queryByText("Exports at 1 cm per grid square.")).not.toBeInTheDocument();
  });
});

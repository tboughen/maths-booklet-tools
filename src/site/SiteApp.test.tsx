import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SiteApp from "./SiteApp";

afterEach(() => window.history.replaceState(null, "", "/"));

describe("route focus (S95)", () => {
  it("leaves focus on the page when it first loads, even under StrictMode's double run", async () => {
    window.history.replaceState(null, "", "/");
    render(
      <StrictMode>
        <SiteApp />
      </StrictMode>,
    );
    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
    // The first Tab must start from the top of the page and reach "Skip to content".
    expect(document.activeElement).toBe(document.body);
  });

  it("still moves focus to the new page's heading after navigation", async () => {
    window.history.replaceState(null, "", "/");
    render(
      <StrictMode>
        <SiteApp />
      </StrictMode>,
    );
    await screen.findByRole("heading", { level: 1 });
    await act(async () => {
      window.history.pushState(null, "", "/tools");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const heading = await screen.findByRole("heading", {
      level: 1,
      name: /booklet tools/i,
    });
    expect(document.activeElement).toBe(heading);
  });
});

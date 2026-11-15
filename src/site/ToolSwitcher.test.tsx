import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageHeading } from "./PageHeading";
import { bookletTools } from "./registry";
import { resetFavouriteToolsForTests } from "./favouriteTools";
import { loadToolSwitcher, resetToolSwitcherForTests, toolPage, ToolPageContext } from "./toolPage";

// On the site the switcher arrives with a tool's page, before its heading draws.
beforeEach(loadToolSwitcher);
afterEach(() => {
  localStorage.clear();
  resetFavouriteToolsForTests();
});

const heading = (tool: (typeof bookletTools)[number]["id"] | null, title: string) =>
  render(
    <ToolPageContext value={tool}>
      <PageHeading title={title} description="A description." />
    </ToolPageContext>,
  );
const open = () => fireEvent.click(within(screen.getByRole("heading", { level: 1 })).getByRole("button"));

describe("ToolSwitcher", () => {
  it("arrives with a tool's page, and a heading drawn before it redraws when it lands", async () => {
    resetToolSwitcherForTests();
    heading("graph", "Graph tool");
    const name = () => within(screen.getByRole("heading", { level: 1, name: "Graph tool" }));
    expect(name().queryByRole("button")).toBeNull();
    // Loading a tool's page as the registry does brings the switcher with it.
    await toolPage(async () => ({ default: () => null })).preload();
    await waitFor(() => expect(name().getByRole("button")).toBeTruthy());
  });

  it("leaves pages that are not diagram tools with a plain heading", () => {
    heading(null, "Worksheet builder");
    expect(screen.getByRole("heading", { level: 1, name: "Worksheet builder" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the tool's name as the page heading and lists every tool once", () => {
    heading("graph", "Graph tool");
    expect(screen.getByRole("heading", { level: 1, name: "Graph tool" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    open();
    const panel = screen.getByRole("dialog", { name: "Switch diagram tool" });
    expect(document.activeElement).toBe(within(panel).getByRole("searchbox", { name: "Find a tool or topic" }));
    const links = [...panel.querySelectorAll<HTMLAnchorElement>("a[data-switch=tool]")];
    expect(links.map((a) => a.getAttribute("href")).sort()).toEqual(bookletTools.map((t) => `/tools/${t.id}`).sort());
    expect(links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent)).toEqual(["Graph tool"]);
    expect(within(panel).getByRole("link", { name: `See all ${bookletTools.length} tools with pictures` }).getAttribute("href")).toBe("/tools");
  });

  it("searches by teaching topic and says what matched", () => {
    heading("graph", "Graph tool");
    open();
    const panel = screen.getByRole("dialog");
    fireEvent.change(within(panel).getByRole("searchbox"), { target: { value: "pythag" } });
    const links = [...panel.querySelectorAll("a[data-switch=tool]")];
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toContain("Triangles");
    expect(links[0].textContent).toContain("Matches “Pythagoras”");
    expect(links[0].className).toBe("is-first");
    expect(within(panel).getByRole("status").textContent).toBe("1 tool found");
    fireEvent.change(within(panel).getByRole("searchbox"), { target: { value: "zzzz" } });
    expect(within(panel).getByText(/No tools found/)).toBeTruthy();
  });

  it("closes on Escape, returns focus to the name and clears the search", () => {
    heading("graph", "Graph tool");
    open();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ratio" } });
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    const button = within(screen.getByRole("heading", { level: 1 })).getByRole("button");
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    open();
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  });

  it("stars the current tool and offers favourites first", () => {
    localStorage.setItem("mathsdock.favouriteTools", JSON.stringify(["venn", "no-such-tool"]));
    heading("graph", "Graph tool");
    fireEvent.click(screen.getByRole("button", { name: "Add Graph tool to favourite tools" }));
    expect(screen.getByRole("button", { name: "Remove Graph tool from favourite tools" }).getAttribute("aria-pressed")).toBe("true");
    expect(JSON.parse(localStorage.getItem("mathsdock.favouriteTools")!)).toEqual(["venn", "no-such-tool", "graph"]);
    open();
    const favourites = within(screen.getByRole("list", { name: "Favourite tools" })).getAllByRole("link");
    expect(favourites.map((a) => a.textContent)).toEqual(["Venn diagrams", "Graph tool"]);
  });

  it("keeps its keys from the editor behind it and treats a search of spaces as no search", () => {
    const editor = vi.fn();
    window.addEventListener("keydown", editor);
    heading("graph", "Graph tool");
    open();
    const panel = screen.getByRole("dialog");
    const link = panel.querySelector<HTMLAnchorElement>("a[data-switch=tool]")!;
    for (const key of ["ArrowDown", "Delete", "Backspace", "Escape"]) fireEvent.keyDown(link, { key });
    expect(editor).not.toHaveBeenCalled();
    window.removeEventListener("keydown", editor);
    open();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  " } });
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getByText("Star a tool and it will wait for you here.")).toBeTruthy();
  });

  // Last: it loads fresh copies of the modules.
  it("lets a tool's page open with a plain heading when the switcher cannot be fetched", async () => {
    resetToolSwitcherForTests();
    vi.resetModules();
    vi.doMock("./ToolSwitcher", () => {
      throw new Error("offline");
    });
    const offline = await import("./toolPage");
    const page = { default: () => null };
    await expect(offline.toolPage(async () => page).preload()).resolves.toBe(page);
    vi.doUnmock("./ToolSwitcher");
    vi.resetModules();
  });
});

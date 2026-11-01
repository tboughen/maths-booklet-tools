import { describe, expect, it } from "vitest";
import { bookletTools } from "./registry";

describe("booklet tool registry", () => {
  it("gives each tool its own icon, so the tool row works as a set of landmarks", () => {
    const owners = new Map<unknown, string[]>();
    for (const tool of bookletTools)
      owners.set(tool.icon, [...(owners.get(tool.icon) ?? []), tool.name]);
    const shared = [...owners.values()].filter((names) => names.length > 1);
    expect(shared).toEqual([]);
  });
});

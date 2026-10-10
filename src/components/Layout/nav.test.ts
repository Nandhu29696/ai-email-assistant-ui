import { describe, expect, it } from "vitest";
import { NAV_GROUPS, canSee, findNav } from "./nav";

const visible = (role: "admin" | "client" | "user") =>
  NAV_GROUPS.flatMap((g) => g.items).filter((i) => canSee(i, role)).map((i) => i.href);

describe("role-based navigation", () => {
  it("admin sees admin pages but not the client Team page", () => {
    expect(visible("admin")).toEqual(expect.arrayContaining(["/admin", "/logs", "/mailboxes"]));
    expect(visible("admin")).not.toContain("/team");
  });

  it("client sees Team, not admin pages", () => {
    expect(visible("client")).toContain("/team");
    expect(visible("client")).not.toContain("/admin");
    expect(visible("client")).not.toContain("/logs");
  });

  it("user sees the client's workspace without Team or admin pages", () => {
    expect(visible("user")).toEqual(["/dashboard", "/emails", "/mailboxes", "/rules", "/settings"]);
  });

  it("guards nested admin routes", () => {
    expect(canSee(findNav("/admin/anything")!, "user")).toBe(false);
    expect(canSee(findNav("/team")!, "client")).toBe(true);
  });
});

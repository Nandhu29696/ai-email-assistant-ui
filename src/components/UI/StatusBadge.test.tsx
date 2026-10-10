import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import StatusBadge, { STATUS_STYLE, statusLabel } from "@/components/UI/StatusBadge";

afterEach(cleanup);

describe("StatusBadge", () => {
  it("gives every status its own colour", () => {
    const colours = Object.values(STATUS_STYLE).map((s) => s.className.split(" ")[0]);
    expect(new Set(colours).size).toBe(colours.length);
  });

  it("shows a readable label", () => {
    render(<StatusBadge status="SUCCESS" />);
    expect(screen.getByText("PDF ready").className).toContain("emerald-600");
    expect(statusLabel("FAILED")).toBe("Needs attention");
    expect(statusLabel("SOMETHING_ELSE")).toBe("SOMETHING_ELSE");
  });
});

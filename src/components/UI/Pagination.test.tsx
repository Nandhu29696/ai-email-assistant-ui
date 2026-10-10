import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import Pagination, { usePagination } from "@/components/UI/Pagination";

afterEach(cleanup);

describe("Pagination", () => {
  it("shows the range, offers 10/20/50/100 rows and moves between pages", () => {
    const calls: Array<[string, number]> = [];
    render(<Pagination page={2} pageSize={10} total={45} label="emails"
      onPageChange={(p) => calls.push(["page", p])} onPageSizeChange={(s) => calls.push(["size", s])} />);
    expect(screen.getByText("11–20")).toBeTruthy();
    expect(screen.getByText("Page 2 of 5")).toBeTruthy();
    const select = screen.getByLabelText("Rows per page") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["10", "20", "50", "100"]);
    fireEvent.change(select, { target: { value: "20" } });
    fireEvent.click(screen.getByLabelText("Next page"));
    fireEvent.click(screen.getByLabelText("Last page"));
    expect(calls).toEqual([["size", 20], ["page", 3], ["page", 5]]);
  });

  it("disables previous on the first page and handles empty lists", () => {
    render(<Pagination page={1} pageSize={5} total={0} onPageChange={() => {}} onPageSizeChange={() => {}} />);
    expect((screen.getByLabelText("Previous page") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Next page") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("0–0")).toBeTruthy();
  });
});

describe("usePagination", () => {
  it("slices client-side lists, 10 rows by default", () => {
    const items = Array.from({ length: 25 }, (_, i) => i + 1);
    const { result } = renderHook(() => usePagination(items));
    expect(result.current.rows).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    act(() => result.current.props.onPageChange(3));
    expect(result.current.rows).toEqual([21, 22, 23, 24, 25]);
    act(() => result.current.props.onPageSizeChange(20));
    expect(result.current.rows).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(result.current.props.page).toBe(1);
  });

  it("stays on a valid page when the list shrinks", () => {
    const { result, rerender } = renderHook(({ items }) => usePagination(items), { initialProps: { items: Array.from({ length: 12 }, (_, i) => i + 1) } });
    act(() => result.current.props.onPageChange(2));
    rerender({ items: [1, 2, 3] });
    expect(result.current.rows).toEqual([1, 2, 3]);
    expect(result.current.props.page).toBe(1);
  });
});

"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  label?: string;   // e.g. "emails"
}

/** Footer for every table: "Showing 1–5 of 22", rows-per-page (5/10/15/20/50) and page buttons. */
export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, label = "rows" }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const button = "rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-sm text-slate-500" role="navigation" aria-label="Pagination">
      <span>
        Showing <strong className="text-slate-700">{from}–{to}</strong> of <strong className="text-slate-700">{total}</strong> {label}
      </span>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Rows per page"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
          >
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button className={button} onClick={() => onPageChange(1)} disabled={page <= 1} aria-label="First page"><ChevronsLeft size={15} /></button>
          <button className={button} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={15} /></button>
          <span className="px-2 whitespace-nowrap">Page {Math.min(page, pages)} of {pages}</span>
          <button className={button} onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label="Next page"><ChevronRight size={15} /></button>
          <button className={button} onClick={() => onPageChange(pages)} disabled={page >= pages} aria-label="Last page"><ChevronsRight size={15} /></button>
        </div>
      </div>
    </div>
  );
}

/** Client-side paging for lists the API returns in full (users, failed jobs, domains). */
export function usePagination<T>(items: T[] | undefined, initialSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const list = items ?? [];
  const pages = Math.max(1, Math.ceil(list.length / pageSize));

  // Stay on a valid page when the list shrinks (filtering, deleting the last row of a page).
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const current = Math.min(page, pages);
  return {
    rows: list.slice((current - 1) * pageSize, current * pageSize),
    props: {
      page: current,
      pageSize,
      total: list.length,
      onPageChange: setPage,
      onPageSizeChange: (size: number) => { setPageSize(size); setPage(1); },
    },
  };
}

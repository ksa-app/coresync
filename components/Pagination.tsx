"use client";

type Props = {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({ page, pageSize, totalCount, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  const maxButtons = 5;
  let start = Math.max(1, page - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);

  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200 text-[13px] text-gray-500 flex-wrap gap-2">
      <div>{totalCount === 0 ? "কোনো রেকর্ড নেই" : `${from}–${to} এর মধ্যে ${totalCount} জন`}</div>
      <div className="flex gap-1 items-center">
        <button
          className="border border-gray-200 bg-white rounded-md px-2.5 py-1 text-xs disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹ Prev
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`border rounded-md px-2.5 py-1 text-xs ${
              p === page ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 bg-white"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          className="border border-gray-200 bg-white rounded-md px-2.5 py-1 text-xs disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

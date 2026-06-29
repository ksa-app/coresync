export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d as string;
  }
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function statusBadgeClass(status: string | null | undefined): string {
  const map: Record<string, string> = {
    "N/A": "bg-gray-100 text-gray-500",
    NEW: "bg-blue-100 text-blue-700",
    FIT: "bg-green-100 text-green-700",
    UNFIT: "bg-red-100 text-red-700",
    USED: "bg-purple-100 text-purple-700",
    EXPIRED: "bg-amber-100 text-amber-700",
    PENDING: "bg-amber-100 text-amber-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  };
  return map[status || "N/A"] || "bg-gray-100 text-gray-500";
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/candidates", label: "Candidates" },
  { href: "/medicals", label: "Medical" },
  { href: "/mofas", label: "Mofa" },
  { href: "/visas", label: "Visa" },
  { href: "/pipeline", label: "Pipeline" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <div className="flex gap-2 flex-wrap mb-4">
      {LINKS.map((link) => {
        const active = pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-lg border ${
              active
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-800 border-gray-200 hover:bg-gray-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

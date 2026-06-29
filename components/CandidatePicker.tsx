"use client";

import { useState } from "react";
import { supabase, TABLES } from "@/lib/supabaseClient";

type CandidateLite = { id: string; name: string; passport_no: string };

type Props = {
  value: CandidateLite | null;
  onChange: (c: CandidateLite | null) => void;
};

export default function CandidatePicker({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CandidateLite[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(val: string) {
    setQuery(val);
    if (!val.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const s = val.replace(/[%,]/g, "");
    const { data, error } = await supabase
      .from(TABLES.candidates)
      .select("id, name, passport_no")
      .eq("is_deleted", false)
      .or(`name.ilike.%${s}%,passport_no.ilike.%${s}%`)
      .limit(8);
    setLoading(false);
    if (!error) setResults((data as CandidateLite[]) || []);
  }

  if (value) {
    return (
      <div className="flex justify-between items-center border border-gray-200 rounded-lg px-2.5 py-2 bg-gray-50 text-sm">
        <span>
          {value.name} ({value.passport_no})
        </span>
        <button type="button" className="text-red-600 text-xs font-semibold" onClick={() => onChange(null)}>
          পরিবর্তন
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="নাম বা পাসপোর্ট লিখুন..."
        className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      {query && (
        <div className="border border-gray-200 rounded-lg mt-1 max-h-40 overflow-y-auto bg-white absolute w-full z-10 shadow-md">
          {loading && <div className="p-2 text-xs text-gray-500">খুঁজছে...</div>}
          {!loading && results.length === 0 && (
            <div className="p-2 text-xs text-gray-500">কোনো প্রার্থী পাওয়া যায়নি</div>
          )}
          {results.map((c) => (
            <div
              key={c.id}
              className="px-2.5 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
              onClick={() => {
                onChange(c);
                setQuery("");
                setResults([]);
              }}
            >
              {c.name} <span className="text-xs text-gray-500">({c.passport_no})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

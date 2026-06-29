"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Pagination from "@/components/Pagination";
import { supabase, TABLES } from "@/lib/supabaseClient";
import { statusBadgeClass } from "@/lib/utils";
import type { PipelineRow, Agent } from "@/lib/types";

const PAGE_SIZE = 15;

const STAGE_OPTIONS = [
  "New / Received",
  "Medical Stage",
  "Medical Done",
  "Mofa Stage",
  "Visa Stage",
  "Visa Approved",
];

export default function PipelinePage() {
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [quickFilter, setQuickFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({ all: 0, new: 0, mofa: 0, visaApproved: 0, critical: 0, expiring: 0 });

  const loadAgents = useCallback(async () => {
    const { data, error } = await supabase.from(TABLES.agents).select('id, full_name, "CODE"').order("full_name");
    if (!error) setAgents((data as Agent[]) || []);
  }, []);

  const loadKpi = useCallback(async () => {
    const { data, error } = await supabase
      .from(TABLES.pipelineView)
      .select("current_stage, medical_critical, visa_expiring_soon, visa_expired");
    if (error) {
      console.error(error);
      return;
    }
    const list = (data as Pick<PipelineRow, "current_stage" | "medical_critical" | "visa_expiring_soon" | "visa_expired">[]) || [];
    setKpi({
      all: list.length,
      new: list.filter((r) => r.current_stage === "New / Received").length,
      mofa: list.filter((r) => r.current_stage === "Mofa Stage").length,
      visaApproved: list.filter((r) => r.current_stage === "Visa Approved").length,
      critical: list.filter((r) => r.medical_critical || r.visa_expired).length,
      expiring: list.filter((r) => r.visa_expiring_soon).length,
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(TABLES.pipelineView).select("*", { count: "exact" });

    if (search) {
      const s = search.replace(/[%,]/g, "");
      query = query.or(`name.ilike.%${s}%,passport_no.ilike.%${s}%`);
    }
    if (filterAgent) query = query.eq("agent_id", filterAgent);
    if (filterStage) query = query.eq("current_stage", filterStage);

    if (quickFilter === "new") query = query.eq("current_stage", "New / Received");
    else if (quickFilter === "mofa") query = query.eq("current_stage", "Mofa Stage");
    else if (quickFilter === "visaApproved") query = query.eq("current_stage", "Visa Approved");
    else if (quickFilter === "critical") query = query.or("medical_critical.eq.true,visa_expired.eq.true");
    else if (quickFilter === "expiring") query = query.eq("visa_expiring_soon", true);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.order("candidate_sl", { ascending: true, nullsFirst: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    setRows((data as PipelineRow[]) || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [search, filterAgent, filterStage, quickFilter, page]);

  useEffect(() => { loadAgents(); loadKpi(); }, [loadAgents, loadKpi]);
  useEffect(() => { load(); }, [load]);

  function toggleQuick(key: string) {
    setQuickFilter((prev) => (prev === key ? "" : key));
    setFilterStage("");
    setPage(1);
  }

  function stageClass(stage: string) {
    const map: Record<string, string> = {
      "New / Received": "bg-gray-100 text-gray-500",
      "Medical Stage": "bg-blue-100 text-blue-700",
      "Medical Done": "bg-green-100 text-green-700",
      "Mofa Stage": "bg-amber-100 text-amber-700",
      "Visa Stage": "bg-purple-100 text-purple-700",
      "Visa Approved": "bg-green-100 text-green-700",
    };
    return map[stage] || "bg-gray-100 text-gray-500";
  }

  return (
    <div>
      <Navbar />
      <h1 className="text-xl font-bold mb-1">🧭 Pipeline Overview</h1>
      <p className="text-xs text-gray-500 mb-4">
        <code>candidate_pipeline</code> SQL view থেকে — এক কোয়েরিতেই সব স্টেজের লেটেস্ট স্ট্যাটাস
      </p>

      {/* KPI chips */}
      <div className="flex gap-2.5 flex-wrap mb-4">
        <Chip label="মোট" value={kpi.all} active={quickFilter === ""} onClick={() => { setQuickFilter(""); setPage(1); }} />
        <Chip label="New" value={kpi.new} active={quickFilter === "new"} color="text-blue-600" onClick={() => toggleQuick("new")} />
        <Chip label="Mofa Stage" value={kpi.mofa} active={quickFilter === "mofa"} color="text-amber-600" onClick={() => toggleQuick("mofa")} />
        <Chip label="Visa Approved" value={kpi.visaApproved} active={quickFilter === "visaApproved"} color="text-green-600" onClick={() => toggleQuick("visaApproved")} />
        <Chip label="Critical" value={kpi.critical} active={quickFilter === "critical"} color="text-red-600" onClick={() => toggleQuick("critical")} />
        <Chip label="Visa Expiring Soon" value={kpi.expiring} active={quickFilter === "expiring"} color="text-amber-600" onClick={() => toggleQuick("expiring")} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 items-end mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-gray-500">Search</label>
          <input type="search" placeholder="নাম / পাসপোর্ট" className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-44"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-gray-500">Agent</label>
          <select className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-40" value={filterAgent}
            onChange={(e) => { setFilterAgent(e.target.value); setPage(1); }}>
            <option value="">সব এজেন্ট</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.CODE ? `${a.full_name} (${a.CODE})` : a.full_name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-gray-500">Current Stage</label>
          <select className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-44" value={filterStage}
            onChange={(e) => { setFilterStage(e.target.value); setQuickFilter(""); setPage(1); }}>
            <option value="">সব স্টেজ</option>
            {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100"
          onClick={() => { setSearch(""); setFilterAgent(""); setFilterStage(""); setQuickFilter(""); setPage(1); }}>
          Clear সব ফিল্টার
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[1300px]">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <th className="text-left px-3 py-2.5 border-b border-gray-200">SL</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Name</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Passport</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Agent</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Current Stage</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Medical</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Mofa</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Visa</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Flags</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center text-gray-500 py-10">লোড হচ্ছে...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="text-center text-gray-500 py-12">
                  কোনো রেকর্ড পাওয়া যায়নি — <code>candidate_pipeline</code> view তৈরি হয়েছে কিনা চেক করুন
                </td></tr>
              ) : (
                rows.map((r) => {
                  const isCritical = r.medical_critical || r.visa_expired;
                  const agentLabel = r.agent_name ? (r.agent_code ? `${r.agent_name} (${r.agent_code})` : r.agent_name) : "—";
                  return (
                    <tr key={r.candidate_id} className={`border-b border-gray-100 hover:bg-gray-50 ${isCritical ? "bg-red-50" : ""}`}>
                      <td className="px-3 py-2.5">{r.candidate_sl ?? "—"}</td>
                      <td className="px-3 py-2.5 font-semibold">{r.name}</td>
                      <td className="px-3 py-2.5">{r.passport_no}</td>
                      <td className="px-3 py-2.5">{agentLabel}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${stageClass(r.current_stage)}`}>{r.current_stage}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.medical_id ? <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${statusBadgeClass(r.medical_status)}`}>{r.medical_status ?? "N/A"}</span> : <span className="px-2 py-0.5 rounded-full text-[10.5px] bg-gray-100 text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.mofa_id ? <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-green-100 text-green-700">Applied</span> : <span className="px-2 py-0.5 rounded-full text-[10.5px] bg-gray-100 text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.visa_id ? <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${statusBadgeClass(r.visa_status)}`}>{r.visa_status ?? "PENDING"}</span> : <span className="px-2 py-0.5 rounded-full text-[10.5px] bg-gray-100 text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.visa_expired && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-600 mr-1">Visa Expired</span>}
                        {!r.visa_expired && r.visa_expiring_soon && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-600 mr-1">Expiring Soon</span>}
                        {r.medical_critical && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-600 mr-1">Medical {r.medical_status}</span>}
                        {r.mofa_pending_after_fit_medical && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-600 mr-1">Mofa Pending</span>}
                        {!r.visa_expired && !r.visa_expiring_soon && !r.medical_critical && !r.mofa_pending_after_fit_medical && "—"}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <a className="text-[11px] font-semibold px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 mr-1" href="/candidates">Candidate</a>
                        <a className="text-[11px] font-semibold px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 mr-1" href={`/medicals?candidate_id=${r.candidate_id}&name=${encodeURIComponent(r.name)}&passport=${encodeURIComponent(r.passport_no)}`}>Med</a>
                        <a className="text-[11px] font-semibold px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 mr-1" href={`/mofas?candidate_id=${r.candidate_id}&name=${encodeURIComponent(r.name)}&passport=${encodeURIComponent(r.passport_no)}`}>Mofa</a>
                        <a className="text-[11px] font-semibold px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100" href={`/visas?candidate_id=${r.candidate_id}&name=${encodeURIComponent(r.name)}&passport=${encodeURIComponent(r.passport_no)}`}>Visa</a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
      </div>
    </div>
  );
}

function Chip({ label, value, active, color, onClick }: { label: string; value: number; active: boolean; color?: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-lg px-3.5 py-2 flex items-center gap-2 text-[12.5px] cursor-pointer select-none ${
        active ? "border-blue-500 bg-blue-50" : "border-gray-200"
      }`}
    >
      <span className={`font-extrabold text-[15px] ${color ?? ""}`}>{value}</span> {label}
    </div>
  );
}

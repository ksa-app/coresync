"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { supabase, TABLES } from "@/lib/supabaseClient";
import { daysBetween } from "@/lib/utils";
import type { Candidate, Agent, Agency, Medical, Mofa, Visa } from "@/lib/types";

type Alert = {
  level: "red" | "amber" | "blue";
  label: string;
  name: string;
  passport: string;
  detail: string;
  href: string;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [medicals, setMedicals] = useState<Medical[]>([]);
  const [visas, setVisas] = useState<Visa[]>([]);
  const [mofas, setMofas] = useState<Mofa[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agency, setAgency] = useState<Agency[]>([]);

  const [latestMedical, setLatestMedical] = useState<Record<string, Medical>>({});
  const [latestVisa, setLatestVisa] = useState<Record<string, Visa>>({});
  const [latestMofa, setLatestMofa] = useState<Record<string, Mofa>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [c, m, v, mf, ag, agc] = await Promise.all([
      supabase.from(TABLES.candidates).select("*").eq("is_deleted", false),
      supabase.from(TABLES.medicals).select("*"),
      supabase.from(TABLES.visas).select("*"),
      supabase.from(TABLES.mofas).select("*"),
      supabase.from(TABLES.agents).select('id, full_name, "CODE"'),
      supabase.from(TABLES.agency).select("uuid, name, rl"),
    ]);

    const candidateRows = (c.data as Candidate[]) || [];
    const medicalRows = (m.data as Medical[]) || [];
    const visaRows = (v.data as Visa[]) || [];
    const mofaRows = (mf.data as Mofa[]) || [];

    setCandidates(candidateRows);
    setMedicals(medicalRows);
    setVisas(visaRows);
    setMofas(mofaRows);
    setAgents((ag.data as Agent[]) || []);
    setAgency((agc.data as Agency[]) || []);

    const medMap: Record<string, Medical> = {};
    [...medicalRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((row) => { if (!medMap[row.candidate_id]) medMap[row.candidate_id] = row; });
    setLatestMedical(medMap);

    const visaMap: Record<string, Visa> = {};
    [...visaRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((row) => { if (!visaMap[row.candidate_id]) visaMap[row.candidate_id] = row; });
    setLatestVisa(visaMap);

    const mofaMap: Record<string, Mofa> = {};
    [...mofaRows].sort((a, b) => b.sl - a.sl)
      .forEach((row) => { if (!mofaMap[row.candidate]) mofaMap[row.candidate] = row; });
    setLatestMofa(mofaMap);

    setLastUpdated(new Date().toLocaleString("bn-BD", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short", year: "numeric" }));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ===== KPI numbers =====
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const newThisMonth = candidates.filter((c) => c.received_date && c.received_date.slice(0, 7) === thisMonthKey).length;
  const pendingVisas = Object.values(latestVisa).filter((v) => v.status === "PENDING").length;
  const approvedVisas = Object.values(latestVisa).filter((v) => v.status === "APPROVED" || v.status === "USED").length;
  const unfitOrExpiredMedical = Object.values(latestMedical).filter((m) => m.status === "UNFIT" || m.status === "EXPIRED").length;

  const kpis = [
    { icon: "👥", value: candidates.length, label: "মোট প্রার্থী", border: "border-t-blue-600" },
    { icon: "🆕", value: newThisMonth, label: "এই মাসে নতুন", border: "border-t-green-600" },
    { icon: "🛂", value: approvedVisas, label: "ভিসা Approved/Used", border: "border-t-purple-600" },
    { icon: "⏳", value: pendingVisas, label: "ভিসা Pending", border: "border-t-amber-600" },
    { icon: "⚠️", value: unfitOrExpiredMedical, label: "মেডিকেল Unfit/Expired", border: "border-t-red-600" },
    { icon: "🏢", value: `${agents.length} / ${agency.length}`, label: "এজেন্ট / এজেন্সি", border: "border-t-gray-400" },
  ];

  // ===== Critical alerts =====
  const candMap: Record<string, Candidate> = {};
  candidates.forEach((c) => (candMap[c.id] = c));
  const alerts: Alert[] = [];

  Object.entries(latestVisa).forEach(([candId, v]) => {
    const cand = candMap[candId];
    if (!cand) return;
    if (v.expiry_date) {
      const days = daysBetween(now, new Date(v.expiry_date));
      if (days >= 0 && days <= 30) {
        alerts.push({
          level: days <= 7 ? "red" : "amber",
          label: days <= 7 ? "Expiring Soon" : "Expiry Alert",
          name: cand.name,
          passport: cand.passport_no,
          detail: `ভিসার মেয়াদ আর ${days} দিন বাকি (${v.expiry_date})`,
          href: `/visas?candidate_id=${cand.id}&name=${encodeURIComponent(cand.name)}&passport=${encodeURIComponent(cand.passport_no)}`,
        });
      } else if (days < 0) {
        alerts.push({
          level: "red", label: "Visa Expired", name: cand.name, passport: cand.passport_no,
          detail: `ভিসার মেয়াদ শেষ হয়ে গেছে (${v.expiry_date})`,
          href: `/visas?candidate_id=${cand.id}&name=${encodeURIComponent(cand.name)}&passport=${encodeURIComponent(cand.passport_no)}`,
        });
      }
    }
    if (v.status === "REJECTED") {
      alerts.push({
        level: "red", label: "Visa Rejected", name: cand.name, passport: cand.passport_no,
        detail: "ভিসা রিজেক্ট হয়েছে — পুনঃআবেদন প্রয়োজন",
        href: `/visas?candidate_id=${cand.id}&name=${encodeURIComponent(cand.name)}&passport=${encodeURIComponent(cand.passport_no)}`,
      });
    }
    if (v.flight_date) {
      const days = daysBetween(now, new Date(v.flight_date));
      if (days >= 0 && days <= 7) {
        alerts.push({
          level: "blue", label: "Flight Soon", name: cand.name, passport: cand.passport_no,
          detail: `ফ্লাইট আর ${days} দিনের মধ্যে (${v.flight_date})`,
          href: `/visas?candidate_id=${cand.id}&name=${encodeURIComponent(cand.name)}&passport=${encodeURIComponent(cand.passport_no)}`,
        });
      }
    }
  });

  Object.entries(latestMedical).forEach(([candId, m]) => {
    const cand = candMap[candId];
    if (!cand) return;
    if (m.status === "UNFIT") {
      alerts.push({
        level: "red", label: "Medical Unfit", name: cand.name, passport: cand.passport_no,
        detail: "মেডিকেল রিপোর্ট UNFIT এসেছে",
        href: `/medicals?candidate_id=${cand.id}&name=${encodeURIComponent(cand.name)}&passport=${encodeURIComponent(cand.passport_no)}`,
      });
    }
    if (m.status === "EXPIRED") {
      alerts.push({
        level: "amber", label: "Medical Expired", name: cand.name, passport: cand.passport_no,
        detail: "মেডিকেলের মেয়াদ শেষ হয়ে গেছে — নতুন মেডিকেল প্রয়োজন",
        href: `/medicals?candidate_id=${cand.id}&name=${encodeURIComponent(cand.name)}&passport=${encodeURIComponent(cand.passport_no)}`,
      });
    }
    if (m.status === "FIT" && !m.mofa_update) {
      alerts.push({
        level: "amber", label: "Mofa Pending", name: cand.name, passport: cand.passport_no,
        detail: "মেডিকেল FIT কিন্তু এখনো Mofa Update হয়নি",
        href: `/mofas?candidate_id=${cand.id}&name=${encodeURIComponent(cand.name)}&passport=${encodeURIComponent(cand.passport_no)}&action=add`,
      });
    }
  });

  candidates.forEach((c) => {
    if (!latestMedical[c.id] && c.received_date) {
      const days = daysBetween(new Date(c.received_date), now);
      if (days > 14) {
        alerts.push({
          level: "amber", label: "No Medical Yet", name: c.name, passport: c.passport_no,
          detail: `গ্রহণের ${days} দিন পরও মেডিকেল শুরু হয়নি`,
          href: `/medicals?candidate_id=${c.id}&name=${encodeURIComponent(c.name)}&passport=${encodeURIComponent(c.passport_no)}&action=add`,
        });
      }
    }
  });

  const order: Record<string, number> = { red: 0, amber: 1, blue: 2 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);

  // ===== Agent table =====
  const agentGroups: Record<string, { label: string; candidates: Candidate[] }> = {};
  agents.forEach((a) => { agentGroups[a.id] = { label: a.CODE ? `${a.full_name} (${a.CODE})` : a.full_name, candidates: [] }; });
  agentGroups["__none__"] = { label: "এজেন্ট ছাড়া", candidates: [] };
  candidates.forEach((c) => {
    const key = c.agent || "__none__";
    if (!agentGroups[key]) agentGroups[key] = { label: "Unknown", candidates: [] };
    agentGroups[key].candidates.push(c);
  });
  const agentRows = Object.values(agentGroups)
    .filter((a) => a.candidates.length > 0)
    .map((a) => {
      const total = a.candidates.length;
      const medDone = a.candidates.filter((c) => {
        const m = latestMedical[c.id];
        return m && (m.status === "FIT" || m.status === "USED");
      }).length;
      const visaApproved = a.candidates.filter((c) => {
        const v = latestVisa[c.id];
        return v && (v.status === "APPROVED" || v.status === "USED");
      }).length;
      const mofaApplied = a.candidates.filter((c) => !!latestMofa[c.id]).length;
      const progress = total > 0 ? Math.round(((medDone + visaApproved + mofaApplied) / (total * 3)) * 100) : 0;
      return { label: a.label, total, medDone, visaApproved, mofaApplied, progress };
    })
    .sort((a, b) => b.total - a.total);

  // ===== Recent activity =====
  type ActivityItem = { type: string; date: string; title: string; meta: string };
  const activity: ActivityItem[] = [];
  candidates.forEach((c) => {
    if (c.received_date) activity.push({ type: "candidate", date: c.received_date, title: `নতুন প্রার্থী যুক্ত হয়েছে: ${c.name}`, meta: `Passport: ${c.passport_no}` });
  });
  medicals.forEach((m) => {
    const c = candMap[m.candidate_id];
    activity.push({ type: "medical", date: m.created_at, title: `মেডিকেল রেকর্ড: ${c ? c.name : "Unknown"} — ${m.status || "N/A"}`, meta: m.medical_date ? `Medical Date: ${m.medical_date}` : "" });
  });
  visas.forEach((v) => {
    const c = candMap[v.candidate_id];
    activity.push({ type: "visa", date: v.created_at, title: `ভিসা রেকর্ড: ${c ? c.name : "Unknown"} — ${v.status || "PENDING"}`, meta: v.visa_type ? `Type: ${v.visa_type}` : "" });
  });
  mofas.forEach((m) => {
    const c = candMap[m.candidate];
    if (m.aplication_date) activity.push({ type: "mofa", date: m.aplication_date, title: `মোফা আবেদন: ${c ? c.name : "Unknown"}`, meta: m.application_number ? `App. No: ${m.application_number}` : "" });
  });
  const recentActivity = activity
    .filter((i) => i.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 25);

  // ===== System summary =====
  const sysCards = [
    { num: candidates.length, lbl: "Candidates" },
    { num: medicals.length, lbl: "Medical Records" },
    { num: mofas.length, lbl: "Mofa Records" },
    { num: visas.length, lbl: "Visa Records" },
    { num: agents.length, lbl: "Agents" },
    { num: agency.length, lbl: "Agencies" },
    { num: visas.filter((v) => v.status === "APPROVED").length, lbl: "Visa Approved" },
    { num: visas.filter((v) => v.status === "REJECTED").length, lbl: "Visa Rejected" },
    { num: medicals.filter((m) => m.status === "FIT").length, lbl: "Medical FIT" },
    { num: medicals.filter((m) => m.status === "UNFIT").length, lbl: "Medical UNFIT" },
  ];

  const dotColor: Record<string, string> = {
    candidate: "bg-blue-600",
    medical: "bg-blue-700",
    mofa: "bg-amber-500",
    visa: "bg-purple-600",
  };
  const alertBadgeColor: Record<string, string> = {
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-600",
    blue: "bg-blue-100 text-blue-700",
  };

  return (
    <div>
      <Navbar />
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-extrabold m-0">📊 ERP Dashboard</h1>
          <div className="text-xs text-gray-500 mt-0.5">{loading ? "লোড হচ্ছে..." : `সর্বশেষ আপডেট: ${lastUpdated}`}</div>
        </div>
        <button onClick={load} className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100">
          ⟳ Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {kpis.map((k, i) => (
          <div key={i} className={`bg-white border border-gray-200 rounded-xl p-3.5 border-t-[3px] ${k.border}`}>
            <div className="text-lg">{k.icon}</div>
            <div className="text-2xl font-extrabold leading-none mt-1">{k.value}</div>
            <div className="text-[11px] text-gray-500 font-semibold mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Critical alerts */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <h2 className="text-[14.5px] font-bold mb-3 flex justify-between items-center">
          🚨 Critical / Action Needed
          <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{alerts.length}</span>
        </h2>
        <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="text-center text-gray-500 text-[12.5px] py-8">🎉 কোনো critical issue নেই — সব ঠিক আছে!</div>
          ) : (
            alerts.slice(0, 40).map((a, i) => (
              <a key={i} href={a.href} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-gray-200 text-[12.5px] hover:bg-gray-50">
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md uppercase whitespace-nowrap ${alertBadgeColor[a.level]}`}>{a.label}</span>
                <span className="flex-1">
                  <div className="font-bold">{a.name} <span className="text-gray-500 font-normal">({a.passport})</span></div>
                  <div className="text-gray-500 text-[11.5px]">{a.detail}</div>
                </span>
              </a>
            ))
          )}
        </div>
      </div>

      {/* Agent table + Recent activity */}
      <div className="grid lg:grid-cols-2 gap-3.5 mb-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-[14.5px] font-bold mb-3 flex justify-between items-center">
            👤 এজেন্ট অনুযায়ী অবস্থা
            <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{agentRows.length} এজেন্ট</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[10.5px] uppercase text-gray-500">
                  <th className="text-left px-2.5 py-2 border-b border-gray-200">Agent</th>
                  <th className="text-left px-2.5 py-2 border-b border-gray-200">Candidates</th>
                  <th className="text-left px-2.5 py-2 border-b border-gray-200">Med Done</th>
                  <th className="text-left px-2.5 py-2 border-b border-gray-200">Visa Approved</th>
                  <th className="text-left px-2.5 py-2 border-b border-gray-200">Mofa Applied</th>
                  <th className="text-left px-2.5 py-2 border-b border-gray-200">Progress</th>
                </tr>
              </thead>
              <tbody>
                {agentRows.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-500 py-6">কোনো ডেটা নেই</td></tr>
                ) : (
                  agentRows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-2.5 py-2 font-semibold">{r.label}</td>
                      <td className="px-2.5 py-2">{r.total}</td>
                      <td className="px-2.5 py-2">{r.medDone}</td>
                      <td className="px-2.5 py-2">{r.visaApproved}</td>
                      <td className="px-2.5 py-2">{r.mofaApplied}</td>
                      <td className="px-2.5 py-2">
                        <div className="flex items-center gap-2">
                          <div className="bg-gray-100 rounded-full h-1.5 w-20 overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${r.progress}%` }} />
                          </div>
                          <span className="text-[11px] text-gray-500">{r.progress}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-[14.5px] font-bold mb-3">🕒 সাম্প্রতিক কার্যক্রম</h2>
          <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="text-center text-gray-500 text-[12.5px] py-8">কোনো সাম্প্রতিক কার্যক্রম নেই</div>
            ) : (
              recentActivity.map((i, idx) => (
                <div key={idx} className="flex gap-2.5 items-start text-[12.5px]">
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor[i.type]}`} />
                  <div>
                    <div className="font-semibold">{i.title}</div>
                    <div className="text-gray-500 text-[11px]">
                      {i.meta} {i.meta ? "•" : ""} {new Date(i.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* System summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="text-[14.5px] font-bold mb-3">🗄️ সিস্টেম সামারি</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {sysCards.map((c, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-2.5 text-center">
              <div className="text-lg font-extrabold">{c.num}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{c.lbl}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

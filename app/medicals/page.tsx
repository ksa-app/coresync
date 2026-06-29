"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import CandidatePicker from "@/components/CandidatePicker";
import { supabase, TABLES } from "@/lib/supabaseClient";
import { fmtDate, statusBadgeClass } from "@/lib/utils";
import type { Medical, MedicalStatus } from "@/lib/types";

const PAGE_SIZE = 10;
const STATUS_OPTIONS: MedicalStatus[] = ["N/A", "NEW", "FIT", "UNFIT", "USED", "EXPIRED"];

type CandidateLite = { id: string; name: string; passport_no: string };

function MedicalsInner() {
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<Medical[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterMofa, setFilterMofa] = useState("");
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<CandidateLite | null>(null);
  const [form, setForm] = useState({
    medical_date: "",
    fit_date: "",
    status: "N/A" as MedicalStatus,
    mofa_update: false,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(TABLES.medicals).select("*, candidates(id, name, passport_no)", { count: "exact" });

    if (filterStatus) query = query.eq("status", filterStatus);
    if (filterDate) query = query.eq("medical_date", filterDate);
    if (filterMofa !== "") query = query.eq("mofa_update", filterMofa === "true");
    if (search) {
      const s = search.replace(/[%,]/g, "");
      query = query.or(`name.ilike.%${s}%,passport_no.ilike.%${s}%`, { foreignTable: "candidates" });
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.order("sl", { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (!error) {
      setRows((data as Medical[]) || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [filterStatus, filterDate, filterMofa, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  // handle deep-link params from candidates page (run once)
  useEffect(() => {
    const candidateId = searchParams.get("candidate_id");
    const name = searchParams.get("name");
    const passport = searchParams.get("passport");
    const action = searchParams.get("action");

    if (!candidateId) return;

    if (action === "add") {
      setEditingId(null);
      setCandidate({ id: candidateId, name: name || "", passport_no: passport || "" });
      setForm({ medical_date: "", fit_date: "", status: "N/A", mofa_update: false });
      setShowModal(true);
    } else if (passport) {
      setSearch(passport);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleMofaUpdate(id: string, current: boolean | null) {
    const { error } = await supabase.from(TABLES.medicals).update({ mofa_update: !current }).eq("id", id);
    if (!error) load();
  }

  function openAddModal() {
    setEditingId(null);
    setCandidate(null);
    setForm({ medical_date: "", fit_date: "", status: "N/A", mofa_update: false });
    setShowModal(true);
  }

  function openEditModal(m: Medical) {
    setEditingId(m.id);
    setCandidate(m.candidates ? { id: m.candidates.id, name: m.candidates.name, passport_no: m.candidates.passport_no } : null);
    setForm({
      medical_date: m.medical_date ?? "",
      fit_date: m.fit_date ?? "",
      status: (m.status as MedicalStatus) ?? "N/A",
      mofa_update: !!m.mofa_update,
    });
    setShowModal(true);
  }

  async function save() {
    if (!candidate) {
      alert("একজন Candidate নির্বাচন করুন");
      return;
    }
    const payload = {
      candidate_id: candidate.id,
      medical_date: form.medical_date || null,
      fit_date: form.fit_date || null,
      status: form.status,
      mofa_update: form.mofa_update,
    };
    const { error } = editingId
      ? await supabase.from(TABLES.medicals).update(payload).eq("id", editingId)
      : await supabase.from(TABLES.medicals).insert(payload);

    if (error) {
      alert("সংরক্ষণ করতে ব্যর্থ: " + error.message);
      return;
    }
    setShowModal(false);
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from(TABLES.medicals).delete().eq("id", deleteId);
    if (!error) load();
    setDeleteId(null);
  }

  return (
    <div>
      <Navbar />
      <h1 className="text-xl font-bold mb-1">Medical Management</h1>
      <p className="text-xs text-gray-500 mb-4">প্রার্থীর মেডিকেল স্ট্যাটাস ব্যবস্থাপনা</p>

      <div className="flex flex-wrap gap-2.5 items-end mb-4 justify-between">
        <div className="flex flex-wrap gap-2.5 items-end">
          <Sel label="Status" value={filterStatus} onChange={(v) => { setFilterStatus(v); setPage(1); }} options={["", ...STATUS_OPTIONS]} />
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-gray-500">Medical Date</label>
            <input type="date" className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-36" value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setPage(1); }} />
          </div>
          <Sel label="Mofa Update" value={filterMofa} onChange={(v) => { setFilterMofa(v); setPage(1); }} options={["", "true", "false"]} labels={{ "": "সব", true: "হয়েছে", false: "হয়নি" } as any} />
          <button className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100"
            onClick={() => { setFilterStatus(""); setFilterDate(""); setFilterMofa(""); setSearch(""); setPage(1); }}>Clear</button>
        </div>
        <div className="flex gap-2.5 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-gray-500">Search</label>
            <input type="search" placeholder="নাম / পাসপোর্ট" className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-44"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <button className="text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={openAddModal}>
            + Add Medical
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <th className="text-left px-3 py-2.5 border-b border-gray-200">SL</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Candidate</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Passport</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Medical Date</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Fit Date</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Status</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Mofa Update</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center text-gray-500 py-10">লোড হচ্ছে...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-gray-500 py-12">কোনো মেডিকেল রেকর্ড পাওয়া যায়নি</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 border-b border-gray-100">
                    <td className="px-3 py-2.5">{r.sl ?? "—"}</td>
                    <td className="px-3 py-2.5 font-semibold">{r.candidates?.name ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.candidates?.passport_no ?? "—"}</td>
                    <td className="px-3 py-2.5">{fmtDate(r.medical_date)}</td>
                    <td className="px-3 py-2.5">{fmtDate(r.fit_date)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeClass(r.status)}`}>{r.status ?? "N/A"}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        className={`text-xs px-2.5 py-1 rounded-full border ${r.mofa_update ? "bg-green-100 border-green-200 text-green-700 font-semibold" : "border-gray-200 text-gray-500"}`}
                        onClick={() => toggleMofaUpdate(r.id, r.mofa_update)}
                      >
                        {r.mofa_update ? "✓ হয়েছে" : "— হয়নি"}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button className="text-[11.5px] font-semibold px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 mr-1" onClick={() => openEditModal(r)}>Edit</button>
                      <button className="text-[11.5px] font-semibold px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100" onClick={() => setDeleteId(r.id)}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
      </div>

      <Modal
        open={showModal}
        title={editingId ? "Edit Medical" : "Add Medical"}
        onClose={() => setShowModal(false)}
        footer={
          <>
            <button className="text-xs font-semibold px-4 py-2 rounded-lg border border-gray-200 bg-white" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white" onClick={save}>Save</button>
          </>
        }
      >
        <Field label="Candidate *">
          <CandidatePicker value={candidate} onChange={setCandidate} />
        </Field>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Medical Date">
            <input type="date" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.medical_date}
              onChange={(e) => setForm({ ...form, medical_date: e.target.value })} />
          </Field>
          <Field label="Fit Date">
            <input type="date" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.fit_date}
              onChange={(e) => setForm({ ...form, fit_date: e.target.value })} />
          </Field>
        </div>
        <Field label="Status">
          <select className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as MedicalStatus })}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.mofa_update} onChange={(e) => setForm({ ...form, mofa_update: e.target.checked })} />
          Mofa Update হয়েছে
        </label>
      </Modal>

      <Modal
        open={!!deleteId}
        title="Delete Medical Record"
        onClose={() => setDeleteId(null)}
        maxWidth="max-w-[380px]"
        footer={
          <>
            <button className="text-xs font-semibold px-4 py-2 rounded-lg border border-gray-200 bg-white" onClick={() => setDeleteId(null)}>Cancel</button>
            <button className="text-xs font-semibold px-4 py-2 rounded-lg bg-red-100 text-red-600" onClick={confirmDelete}>Delete</button>
          </>
        }
      >
        <p className="text-sm m-0">আপনি কি নিশ্চিত যে এই মেডিকেল রেকর্ডটি ডিলিট করতে চান? এই কাজটি স্থায়ী।</p>
      </Modal>
    </div>
  );
}

export default function MedicalsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500">লোড হচ্ছে...</div>}>
      <MedicalsInner />
    </Suspense>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-xs font-semibold text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Sel({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string>; }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase font-bold text-gray-500">{label}</label>
      <select className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-36" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>{labels?.[o] ?? (o === "" ? "সব" : o)}</option>
        ))}
      </select>
    </div>
  );
}

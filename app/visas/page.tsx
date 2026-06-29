"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import CandidatePicker from "@/components/CandidatePicker";
import { supabase, TABLES } from "@/lib/supabaseClient";
import { fmtDate, statusBadgeClass } from "@/lib/utils";
import type { Visa, VisaStatus, Agency } from "@/lib/types";

const PAGE_SIZE = 10;
const STATUS_OPTIONS: VisaStatus[] = ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "USED"];
type CandidateLite = { id: string; name: string; passport_no: string };

function VisasInner() {
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<Visa[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAgency, setFilterAgency] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<CandidateLite | null>(null);
  const [form, setForm] = useState({
    visa_type: "",
    iqamah_number: "",
    issue_date: "",
    expiry_date: "",
    flight_date: "",
    agency: "",
    status: "PENDING" as VisaStatus,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadAgencies = useCallback(async () => {
    const { data, error } = await supabase.from(TABLES.agency).select("uuid, name, rl").order("name");
    if (!error) setAgencies((data as Agency[]) || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(TABLES.visas).select("*, candidates(id, name, passport_no)", { count: "exact" });

    if (filterStatus) query = query.eq("status", filterStatus);
    if (filterAgency) query = query.eq("agency", filterAgency);
    if (filterDate) query = query.eq("issue_date", filterDate);
    if (search) {
      const s = search.replace(/[%,]/g, "");
      query = query.or(`name.ilike.%${s}%,passport_no.ilike.%${s}%`, { foreignTable: "candidates" });
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.order("visa_sl", { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (!error) {
      setRows((data as Visa[]) || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [filterStatus, filterAgency, filterDate, search, page]);

  useEffect(() => { loadAgencies(); }, [loadAgencies]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const candidateId = searchParams.get("candidate_id");
    const name = searchParams.get("name");
    const passport = searchParams.get("passport");
    const action = searchParams.get("action");
    if (!candidateId) return;

    if (action === "add") {
      setEditingId(null);
      setCandidate({ id: candidateId, name: name || "", passport_no: passport || "" });
      setForm({ visa_type: "", iqamah_number: "", issue_date: "", expiry_date: "", flight_date: "", agency: "", status: "PENDING" });
      setShowModal(true);
    } else if (passport) {
      setSearch(passport);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function agencyName(id: string | null) {
    const a = agencies.find((x) => x.uuid === id);
    return a?.name ?? "—";
  }

  function openAddModal() {
    setEditingId(null);
    setCandidate(null);
    setForm({ visa_type: "", iqamah_number: "", issue_date: "", expiry_date: "", flight_date: "", agency: "", status: "PENDING" });
    setShowModal(true);
  }

  function openEditModal(v: Visa) {
    setEditingId(v.id);
    setCandidate(v.candidates ? { id: v.candidates.id, name: v.candidates.name, passport_no: v.candidates.passport_no } : null);
    setForm({
      visa_type: v.visa_type ?? "",
      iqamah_number: v.iqamah_number ?? "",
      issue_date: v.issue_date ?? "",
      expiry_date: v.expiry_date ?? "",
      flight_date: v.flight_date ?? "",
      agency: v.agency ?? "",
      status: (v.status as VisaStatus) ?? "PENDING",
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
      visa_type: form.visa_type.trim() || null,
      iqamah_number: form.iqamah_number.trim() || null,
      issue_date: form.issue_date || null,
      expiry_date: form.expiry_date || null,
      flight_date: form.flight_date || null,
      agency: form.agency || null,
      status: form.status,
    };
    const { error } = editingId
      ? await supabase.from(TABLES.visas).update(payload).eq("id", editingId)
      : await supabase.from(TABLES.visas).insert(payload);

    if (error) {
      alert("সংরক্ষণ করতে ব্যর্থ: " + error.message);
      return;
    }
    setShowModal(false);
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from(TABLES.visas).delete().eq("id", deleteId);
    if (!error) load();
    setDeleteId(null);
  }

  return (
    <div>
      <Navbar />
      <h1 className="text-xl font-bold mb-1">Visa Management</h1>
      <p className="text-xs text-gray-500 mb-4">প্রার্থীর ভিসা স্ট্যাটাস ব্যবস্থাপনা</p>

      <div className="flex flex-wrap gap-2.5 items-end mb-4 justify-between">
        <div className="flex flex-wrap gap-2.5 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-gray-500">Status</label>
            <select className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-36" value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
              <option value="">সব স্ট্যাটাস</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-gray-500">Agency</label>
            <select className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-40" value={filterAgency}
              onChange={(e) => { setFilterAgency(e.target.value); setPage(1); }}>
              <option value="">সব এজেন্সি</option>
              {agencies.map((a) => <option key={a.uuid} value={a.uuid}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-gray-500">Issue Date</label>
            <input type="date" className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-36" value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setPage(1); }} />
          </div>
          <button className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100"
            onClick={() => { setFilterStatus(""); setFilterAgency(""); setFilterDate(""); setSearch(""); setPage(1); }}>Clear</button>
        </div>
        <div className="flex gap-2.5 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-gray-500">Search</label>
            <input type="search" placeholder="নাম / পাসপোর্ট" className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-44"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <button className="text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={openAddModal}>
            + Add Visa
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[1300px]">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <th className="text-left px-3 py-2.5 border-b border-gray-200">SL</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Candidate</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Passport</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Visa Type</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Issue Date</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Expiry Date</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Flight Date</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Iqamah No.</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Agency</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Status</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center text-gray-500 py-10">লোড হচ্ছে...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} className="text-center text-gray-500 py-12">কোনো ভিসা রেকর্ড পাওয়া যায়নি</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 border-b border-gray-100">
                    <td className="px-3 py-2.5">{r.visa_sl ?? "—"}</td>
                    <td className="px-3 py-2.5 font-semibold">{r.candidates?.name ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.candidates?.passport_no ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.visa_type ?? "—"}</td>
                    <td className="px-3 py-2.5">{fmtDate(r.issue_date)}</td>
                    <td className="px-3 py-2.5">{fmtDate(r.expiry_date)}</td>
                    <td className="px-3 py-2.5">{fmtDate(r.flight_date)}</td>
                    <td className="px-3 py-2.5">{r.iqamah_number ?? "—"}</td>
                    <td className="px-3 py-2.5">{agencyName(r.agency)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeClass(r.status)}`}>{r.status ?? "PENDING"}</span>
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
        title={editingId ? "Edit Visa" : "Add Visa"}
        onClose={() => setShowModal(false)}
        maxWidth="max-w-[560px]"
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
          <Field label="Visa Type">
            <input className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.visa_type}
              onChange={(e) => setForm({ ...form, visa_type: e.target.value })} />
          </Field>
          <Field label="Iqamah Number">
            <input className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.iqamah_number}
              onChange={(e) => setForm({ ...form, iqamah_number: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3.5">
          <Field label="Issue Date">
            <input type="date" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
          </Field>
          <Field label="Expiry Date">
            <input type="date" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
          </Field>
          <Field label="Flight Date">
            <input type="date" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.flight_date}
              onChange={(e) => setForm({ ...form, flight_date: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Agency">
            <select className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.agency}
              onChange={(e) => setForm({ ...form, agency: e.target.value })}>
              <option value="">— নির্বাচন করুন —</option>
              {agencies.map((a) => <option key={a.uuid} value={a.uuid}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as VisaStatus })}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!deleteId}
        title="Delete Visa Record"
        onClose={() => setDeleteId(null)}
        maxWidth="max-w-[380px]"
        footer={
          <>
            <button className="text-xs font-semibold px-4 py-2 rounded-lg border border-gray-200 bg-white" onClick={() => setDeleteId(null)}>Cancel</button>
            <button className="text-xs font-semibold px-4 py-2 rounded-lg bg-red-100 text-red-600" onClick={confirmDelete}>Delete</button>
          </>
        }
      >
        <p className="text-sm m-0">আপনি কি নিশ্চিত যে এই ভিসা রেকর্ডটি ডিলিট করতে চান? এই কাজটি স্থায়ী।</p>
      </Modal>
    </div>
  );
}

export default function VisasPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500">লোড হচ্ছে...</div>}>
      <VisasInner />
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

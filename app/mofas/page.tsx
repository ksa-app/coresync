"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import CandidatePicker from "@/components/CandidatePicker";
import { supabase, TABLES } from "@/lib/supabaseClient";
import { fmtDate } from "@/lib/utils";
import type { Mofa, Agency } from "@/lib/types";

const PAGE_SIZE = 10;
type CandidateLite = { id: string; name: string; passport_no: string };

function MofasInner() {
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<Mofa[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [filterAgency, setFilterAgency] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterMedUpdate, setFilterMedUpdate] = useState("");
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<CandidateLite | null>(null);
  const [form, setForm] = useState({
    application_number: "",
    aplication_date: "",
    trade: "",
    agency: "",
    med_update: false,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadAgencies = useCallback(async () => {
    const { data, error } = await supabase.from(TABLES.agency).select("uuid, name, rl").order("name");
    if (!error) setAgencies((data as Agency[]) || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(TABLES.mofas).select("*, candidates(id, name, passport_no)", { count: "exact" });

    if (filterAgency) query = query.eq("agency", filterAgency);
    if (filterDate) query = query.eq("aplication_date", filterDate);
    if (filterMedUpdate !== "") query = query.eq("med_update", filterMedUpdate === "true");
    if (search) {
      const s = search.replace(/[%,]/g, "");
      query = query.or(`name.ilike.%${s}%,passport_no.ilike.%${s}%`, { foreignTable: "candidates" });
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.order("sl", { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (!error) {
      setRows((data as Mofa[]) || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [filterAgency, filterDate, filterMedUpdate, search, page]);

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
      setForm({ application_number: "", aplication_date: "", trade: "", agency: "", med_update: false });
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

  async function toggleMedUpdate(id: string, current: boolean | null) {
    const { error } = await supabase.from(TABLES.mofas).update({ med_update: !current }).eq("id", id);
    if (!error) load();
  }

  function openAddModal() {
    setEditingId(null);
    setCandidate(null);
    setForm({ application_number: "", aplication_date: "", trade: "", agency: "", med_update: false });
    setShowModal(true);
  }

  function openEditModal(m: Mofa) {
    setEditingId(m.id);
    setCandidate(m.candidates ? { id: m.candidates.id, name: m.candidates.name, passport_no: m.candidates.passport_no } : null);
    setForm({
      application_number: m.application_number ?? "",
      aplication_date: m.aplication_date ?? "",
      trade: m.trade ?? "",
      agency: m.agency ?? "",
      med_update: !!m.med_update,
    });
    setShowModal(true);
  }

  async function save() {
    if (!candidate) {
      alert("একজন Candidate নির্বাচন করুন");
      return;
    }
    const payload = {
      candidate: candidate.id,
      application_number: form.application_number.trim() || null,
      aplication_date: form.aplication_date || null,
      trade: form.trade.trim() || null,
      agency: form.agency || null,
      med_update: form.med_update,
    };
    const { error } = editingId
      ? await supabase.from(TABLES.mofas).update(payload).eq("id", editingId)
      : await supabase.from(TABLES.mofas).insert(payload);

    if (error) {
      alert("সংরক্ষণ করতে ব্যর্থ: " + error.message);
      return;
    }
    setShowModal(false);
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from(TABLES.mofas).delete().eq("id", deleteId);
    if (!error) load();
    setDeleteId(null);
  }

  return (
    <div>
      <Navbar />
      <h1 className="text-xl font-bold mb-1">Mofa Management</h1>
      <p className="text-xs text-gray-500 mb-4">প্রার্থীর মোফা আবেদন ব্যবস্থাপনা</p>

      <div className="flex flex-wrap gap-2.5 items-end mb-4 justify-between">
        <div className="flex flex-wrap gap-2.5 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-gray-500">Agency</label>
            <select className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-40" value={filterAgency}
              onChange={(e) => { setFilterAgency(e.target.value); setPage(1); }}>
              <option value="">সব এজেন্সি</option>
              {agencies.map((a) => <option key={a.uuid} value={a.uuid}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-gray-500">Application Date</label>
            <input type="date" className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-36" value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setPage(1); }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-gray-500">Med Update</label>
            <select className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-36" value={filterMedUpdate}
              onChange={(e) => { setFilterMedUpdate(e.target.value); setPage(1); }}>
              <option value="">সব</option>
              <option value="true">হয়েছে</option>
              <option value="false">হয়নি</option>
            </select>
          </div>
          <button className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100"
            onClick={() => { setFilterAgency(""); setFilterDate(""); setFilterMedUpdate(""); setSearch(""); setPage(1); }}>Clear</button>
        </div>
        <div className="flex gap-2.5 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-gray-500">Search</label>
            <input type="search" placeholder="নাম / পাসপোর্ট" className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-44"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <button className="text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={openAddModal}>
            + Add Mofa
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[1100px]">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <th className="text-left px-3 py-2.5 border-b border-gray-200">SL</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Candidate</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Passport</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">App. No.</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">App. Date</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Trade</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Agency</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Med Update</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center text-gray-500 py-10">লোড হচ্ছে...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-gray-500 py-12">কোনো মোফা রেকর্ড পাওয়া যায়নি</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 border-b border-gray-100">
                    <td className="px-3 py-2.5">{r.sl ?? "—"}</td>
                    <td className="px-3 py-2.5 font-semibold">{r.candidates?.name ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.candidates?.passport_no ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.application_number ?? "—"}</td>
                    <td className="px-3 py-2.5">{fmtDate(r.aplication_date)}</td>
                    <td className="px-3 py-2.5">{r.trade ?? "—"}</td>
                    <td className="px-3 py-2.5">{agencyName(r.agency)}</td>
                    <td className="px-3 py-2.5">
                      <button
                        className={`text-xs px-2.5 py-1 rounded-full border ${r.med_update ? "bg-green-100 border-green-200 text-green-700 font-semibold" : "border-gray-200 text-gray-500"}`}
                        onClick={() => toggleMedUpdate(r.id, r.med_update)}
                      >
                        {r.med_update ? "✓ হয়েছে" : "— হয়নি"}
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
        title={editingId ? "Edit Mofa" : "Add Mofa"}
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
          <Field label="Application Number">
            <input className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.application_number}
              onChange={(e) => setForm({ ...form, application_number: e.target.value })} />
          </Field>
          <Field label="Application Date">
            <input type="date" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.aplication_date}
              onChange={(e) => setForm({ ...form, aplication_date: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Trade">
            <input className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.trade}
              onChange={(e) => setForm({ ...form, trade: e.target.value })} />
          </Field>
          <Field label="Agency">
            <select className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" value={form.agency}
              onChange={(e) => setForm({ ...form, agency: e.target.value })}>
              <option value="">— নির্বাচন করুন —</option>
              {agencies.map((a) => <option key={a.uuid} value={a.uuid}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.med_update} onChange={(e) => setForm({ ...form, med_update: e.target.checked })} />
          Medical Update হয়েছে
        </label>
      </Modal>

      <Modal
        open={!!deleteId}
        title="Delete Mofa Record"
        onClose={() => setDeleteId(null)}
        maxWidth="max-w-[380px]"
        footer={
          <>
            <button className="text-xs font-semibold px-4 py-2 rounded-lg border border-gray-200 bg-white" onClick={() => setDeleteId(null)}>Cancel</button>
            <button className="text-xs font-semibold px-4 py-2 rounded-lg bg-red-100 text-red-600" onClick={confirmDelete}>Delete</button>
          </>
        }
      >
        <p className="text-sm m-0">আপনি কি নিশ্চিত যে এই মোফা রেকর্ডটি ডিলিট করতে চান? এই কাজটি স্থায়ী।</p>
      </Modal>
    </div>
  );
}

export default function MofasPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500">লোড হচ্ছে...</div>}>
      <MofasInner />
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

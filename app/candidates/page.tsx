"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import { supabase, TABLES } from "@/lib/supabaseClient";
import { fmtDate, statusBadgeClass } from "@/lib/utils";
import type { Candidate, Agent, Medical, Mofa, Visa } from "@/lib/types";

const PAGE_SIZE = 10;

export default function CandidatesPage() {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [medicalsMap, setMedicalsMap] = useState<Record<string, Medical>>({});
  const [visasMap, setVisasMap] = useState<Record<string, Visa>>({});
  const [mofasMap, setMofasMap] = useState<Record<string, Mofa>>({});

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [loading, setLoading] = useState(true);

  // Candidate modal state
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    sl: "",
    passport_no: "",
    name: "",
    received_date: "",
    country: "",
    agent: "",
  });

  // Agent modal
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [agentForm, setAgentForm] = useState({ full_name: "", code: "" });

  // Delete modal
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* ===================== LOAD AGENTS ===================== */
  const loadAgents = useCallback(async () => {
    const { data, error } = await supabase
      .from(TABLES.agents)
      .select('id, full_name, "CODE"')
      .order("full_name");
    if (!error) setAgents((data as Agent[]) || []);
  }, []);

  /* ===================== LOAD STAGE DATA (latest per candidate) ===================== */
  const loadStageData = useCallback(async (candidateIds: string[]) => {
    if (candidateIds.length === 0) {
      setMedicalsMap({});
      setVisasMap({});
      setMofasMap({});
      return;
    }
    const [medRes, visaRes, mofaRes] = await Promise.all([
      supabase.from(TABLES.medicals).select("*").in("candidate_id", candidateIds).order("created_at", { ascending: false }),
      supabase.from(TABLES.visas).select("*").in("candidate_id", candidateIds).order("created_at", { ascending: false }),
      supabase.from(TABLES.mofas).select("*").in("candidate", candidateIds).order("sl", { ascending: false }),
    ]);

    const medMap: Record<string, Medical> = {};
    (medRes.data as Medical[] | null)?.forEach((m) => {
      if (!medMap[m.candidate_id]) medMap[m.candidate_id] = m;
    });
    const visaMapLocal: Record<string, Visa> = {};
    (visaRes.data as Visa[] | null)?.forEach((v) => {
      if (!visaMapLocal[v.candidate_id]) visaMapLocal[v.candidate_id] = v;
    });
    const mofaMapLocal: Record<string, Mofa> = {};
    (mofaRes.data as Mofa[] | null)?.forEach((m) => {
      if (!mofaMapLocal[m.candidate]) mofaMapLocal[m.candidate] = m;
    });

    setMedicalsMap(medMap);
    setVisasMap(visaMapLocal);
    setMofasMap(mofaMapLocal);
  }, []);

  /* ===================== LOAD CANDIDATES ===================== */
  const loadCandidates = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(TABLES.candidates).select("*", { count: "exact" }).eq("is_deleted", false);

    if (search) {
      const s = search.replace(/[%,]/g, "");
      query = query.or(`name.ilike.%${s}%,passport_no.ilike.%${s}%`);
    }
    if (filterAgent) query = query.eq("agent", filterAgent);
    if (filterDate) query = query.eq("received_date", filterDate);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.order("sl", { ascending: true, nullsFirst: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const candidateRows = (data as Candidate[]) || [];
    setTotalCount(count || 0);
    await loadStageData(candidateRows.map((c) => c.id));
    setRows(candidateRows);
    setLoading(false);
  }, [search, filterAgent, filterDate, page, loadStageData]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // client-side stage filter (only affects currently loaded page, same as the original HTML version)
  const filteredRows = rows.filter((r) => {
    if (filterStage === "med") return !!medicalsMap[r.id];
    if (filterStage === "visa") return !!visasMap[r.id];
    if (filterStage === "mofa") return !!mofasMap[r.id];
    return true;
  });

  function agentLabel(agentId: string | null) {
    const a = agents.find((x) => x.id === agentId);
    if (!a) return "—";
    return a.CODE ? `${a.full_name} (${a.CODE})` : a.full_name;
  }

  /* ===================== CANDIDATE MODAL ===================== */
  function openAddModal() {
    setEditingId(null);
    setForm({ sl: "", passport_no: "", name: "", received_date: "", country: "", agent: "" });
    setShowCandidateModal(true);
  }

  async function openEditModal(c: Candidate) {
    setEditingId(c.id);
    setForm({
      sl: c.sl?.toString() ?? "",
      passport_no: c.passport_no,
      name: c.name,
      received_date: c.received_date ?? "",
      country: c.country ?? "",
      agent: c.agent ?? "",
    });
    setShowCandidateModal(true);
  }

  async function saveCandidate() {
    if (!form.passport_no.trim() || !form.name.trim()) {
      alert("Name ও Passport No আবশ্যক");
      return;
    }
    const payload = {
      sl: form.sl ? Number(form.sl) : null,
      passport_no: form.passport_no.trim(),
      name: form.name.trim(),
      received_date: form.received_date || null,
      country: form.country.trim() || null,
      agent: form.agent || null,
    };

    const { error } = editingId
      ? await supabase.from(TABLES.candidates).update(payload).eq("id", editingId)
      : await supabase.from(TABLES.candidates).insert(payload);

    if (error) {
      alert("সংরক্ষণ করতে ব্যর্থ: " + error.message);
      return;
    }
    setShowCandidateModal(false);
    loadCandidates();
  }

  /* ===================== AGENT MODAL ===================== */
  async function saveAgent() {
    if (!agentForm.full_name.trim()) {
      alert("এজেন্টের নাম আবশ্যক");
      return;
    }
    const { error } = await supabase
      .from(TABLES.agents)
      .insert({ full_name: agentForm.full_name.trim(), CODE: agentForm.code.trim() || null });
    if (error) {
      alert("এজেন্ট যুক্ত করতে ব্যর্থ: " + error.message);
      return;
    }
    setShowAgentModal(false);
    setAgentForm({ full_name: "", code: "" });
    loadAgents();
  }

  /* ===================== DELETE ===================== */
  async function confirmDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from(TABLES.candidates).update({ is_deleted: true }).eq("id", deleteId);
    if (error) {
      alert("ডিলিট করতে ব্যর্থ: " + error.message);
    } else {
      loadCandidates();
    }
    setDeleteId(null);
  }

  function stageLink(table: string, candidateId: string, name: string, passport: string, addMode = false) {
    const params = new URLSearchParams({ candidate_id: candidateId, name, passport });
    if (addMode) params.set("action", "add");
    return `/${table}?${params.toString()}`;
  }

  return (
    <div>
      <Navbar />
      <h1 className="text-xl font-bold mb-1">Candidate Management</h1>
      <p className="text-xs text-gray-500 mb-4">ফিল্টার, সার্চ ও পেজিনেশন সহ</p>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2.5 items-end mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-gray-500">Agent</label>
          <select
            className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-36"
            value={filterAgent}
            onChange={(e) => {
              setFilterAgent(e.target.value);
              setPage(1);
            }}
          >
            <option value="">সব এজেন্ট</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.CODE ? `${a.full_name} (${a.CODE})` : a.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-gray-500">Date</label>
          <input
            type="date"
            className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-36"
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-gray-500">Stage</label>
          <select
            className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-36"
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
          >
            <option value="">সব স্টেজ</option>
            <option value="med">Med</option>
            <option value="mofa">Mofa</option>
            <option value="visa">Visa</option>
          </select>
        </div>
        <button
          className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100"
          onClick={() => {
            setSearch("");
            setFilterAgent("");
            setFilterDate("");
            setFilterStage("");
            setPage(1);
          }}
        >
          Clear
        </button>

        <div className="flex flex-col gap-1 ml-auto">
          <label className="text-[10px] uppercase font-bold text-gray-500">Search</label>
          <input
            type="search"
            placeholder="নাম / পাসপোর্ট"
            className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs w-44"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <button
          className="text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          onClick={openAddModal}
        >
          + Candidate
        </button>
        <button
          className="text-xs font-semibold px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-100"
          onClick={() => setShowAgentModal(true)}
        >
          + Agent
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[1200px]">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <th className="text-left px-3 py-2.5 border-b border-gray-200">SL</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Name</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Passport</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Received Date</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Agent</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Medical</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Mofa</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Visa</th>
                <th className="text-left px-3 py-2.5 border-b border-gray-200">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center text-gray-500 py-10">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-gray-500 py-12">
                    কোনো প্রার্থী পাওয়া যায়নি
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const med = medicalsMap[r.id];
                  const visa = visasMap[r.id];
                  const mofa = mofasMap[r.id];
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 border-b border-gray-100">
                      <td className="px-3 py-2.5">{r.sl ?? "—"}</td>
                      <td className="px-3 py-2.5 font-semibold">{r.name}</td>
                      <td className="px-3 py-2.5">{r.passport_no}</td>
                      <td className="px-3 py-2.5">{fmtDate(r.received_date)}</td>
                      <td className="px-3 py-2.5">{agentLabel(r.agent)}</td>
                      <td className="px-3 py-2.5">
                        <a
                          href={stageLink("medicals", r.id, r.name, r.passport_no, !med)}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            med ? statusBadgeClass(med.status) : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {med ? med.status ?? "N/A" : "— Add"}
                        </a>
                      </td>
                      <td className="px-3 py-2.5">
                        <a
                          href={stageLink("mofas", r.id, r.name, r.passport_no, !mofa)}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            mofa ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {mofa ? mofa.application_number || "Applied" : "— Add"}
                        </a>
                      </td>
                      <td className="px-3 py-2.5">
                        <a
                          href={stageLink("visas", r.id, r.name, r.passport_no, !visa)}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            visa ? statusBadgeClass(visa.status) : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {visa ? visa.status ?? "PENDING" : "— Add"}
                        </a>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button
                          className="text-[11.5px] font-semibold px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 mr-1"
                          onClick={() => openEditModal(r)}
                        >
                          Edit
                        </button>
                        {r.scan_copy && (
                          <a
                            href={r.scan_copy}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11.5px] font-semibold px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 mr-1"
                          >
                            Download
                          </a>
                        )}
                        <button
                          className="text-[11.5px] font-semibold px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                          onClick={() => setDeleteId(r.id)}
                        >
                          Delete
                        </button>
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

      {/* Candidate Modal */}
      <Modal
        open={showCandidateModal}
        title={editingId ? "Edit Candidate" : "Add Candidate"}
        onClose={() => setShowCandidateModal(false)}
        footer={
          <>
            <button
              className="text-xs font-semibold px-4 py-2 rounded-lg border border-gray-200 bg-white"
              onClick={() => setShowCandidateModal(false)}
            >
              Cancel
            </button>
            <button
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white"
              onClick={saveCandidate}
            >
              Save
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="SL">
            <input
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
              value={form.sl}
              onChange={(e) => setForm({ ...form, sl: e.target.value })}
            />
          </Field>
          <Field label="Passport No *">
            <input
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
              value={form.passport_no}
              onChange={(e) => setForm({ ...form, passport_no: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Name *">
          <input
            className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Received Date">
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
              value={form.received_date}
              onChange={(e) => setForm({ ...form, received_date: e.target.value })}
            />
          </Field>
          <Field label="Country">
            <input
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Agent">
          <select
            className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
            value={form.agent}
            onChange={(e) => setForm({ ...form, agent: e.target.value })}
          >
            <option value="">— নির্বাচন করুন —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.CODE ? `${a.full_name} (${a.CODE})` : a.full_name}
              </option>
            ))}
          </select>
        </Field>
      </Modal>

      {/* Agent Modal */}
      <Modal
        open={showAgentModal}
        title="Add Agent"
        onClose={() => setShowAgentModal(false)}
        footer={
          <>
            <button
              className="text-xs font-semibold px-4 py-2 rounded-lg border border-gray-200 bg-white"
              onClick={() => setShowAgentModal(false)}
            >
              Cancel
            </button>
            <button className="text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white" onClick={saveAgent}>
              Save
            </button>
          </>
        }
      >
        <Field label="Full Name *">
          <input
            className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
            value={agentForm.full_name}
            onChange={(e) => setAgentForm({ ...agentForm, full_name: e.target.value })}
          />
        </Field>
        <Field label="Code">
          <input
            className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm"
            value={agentForm.code}
            onChange={(e) => setAgentForm({ ...agentForm, code: e.target.value })}
          />
        </Field>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={!!deleteId}
        title="Delete Candidate"
        onClose={() => setDeleteId(null)}
        maxWidth="max-w-[380px]"
        footer={
          <>
            <button
              className="text-xs font-semibold px-4 py-2 rounded-lg border border-gray-200 bg-white"
              onClick={() => setDeleteId(null)}
            >
              Cancel
            </button>
            <button className="text-xs font-semibold px-4 py-2 rounded-lg bg-red-100 text-red-600" onClick={confirmDelete}>
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm m-0">আপনি কি নিশ্চিত যে এই প্রার্থীকে ডিলিট করতে চান? এটি সফট-ডিলিট হবে (is_deleted = true)।</p>
      </Modal>
    </div>
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

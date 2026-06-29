# Candidate ERP — Next.js Version

আগের প্লেইন HTML পেজগুলোর (candidates.html, medicals.html, mofas.html, visas.html, dashboard.html, pipeline.html) একই লজিক এখানে **Next.js 14 (App Router) + TypeScript + Tailwind CSS** দিয়ে লেখা হয়েছে। Supabase ব্যাকএন্ড **একই রকম** রাখা হয়েছে — কোনো টেবিল/স্কিমা বদলায়নি।

## চালানোর ধাপ

```bash
# ১. ডিপেন্ডেন্সি ইনস্টল
npm install

# ২. .env.local তৈরি করুন
cp .env.local.example .env.local
# তারপর .env.local এ আপনার supabase URL ও anon key বসান

# ৩. ডেভ সার্ভার চালু করুন
npm run dev
# http://localhost:3000 ওপেন করুন (এটা /dashboard এ redirect করবে)
```

## ফোল্ডার স্ট্রাকচার

```
app/
  layout.tsx          → root layout (font, container)
  page.tsx             → "/" থেকে "/dashboard" এ redirect
  globals.css          → Tailwind entry
  dashboard/page.tsx    → ERP-style dashboard (KPI, critical alerts, agent table, activity feed, system summary)
  candidates/page.tsx   → Candidate list + add/edit + agent add + delete + filters + pagination
  medicals/page.tsx     → Medical CRUD + URL param দিয়ে deep-link (candidates পেজ থেকে candidate প্রি-সিলেক্ট)
  mofas/page.tsx        → Mofa CRUD
  visas/page.tsx        → Visa CRUD
  pipeline/page.tsx     → candidate_pipeline SQL view থেকে সব স্টেজের সামারি, এক query তে

components/
  Navbar.tsx            → সব পেজে কমন টপ নেভিগেশন
  Modal.tsx             → reusable modal shell
  Pagination.tsx        → reusable pagination control
  CandidatePicker.tsx   → মেডিকেল/মোফা/ভিসা ফর্মে candidate সার্চ-সিলেক্ট করার কম্পোনেন্ট

lib/
  supabaseClient.ts     → একটাই supabase client (singleton) + টেবিল নামের constant
  types.ts              → আপনার Postgres স্কিমা অনুযায়ী TypeScript টাইপ
  utils.ts              → fmtDate, statusBadgeClass ইত্যাদি ছোট হেল্পার

pipeline_setup.sql       → candidate_pipeline VIEW + ইনডেক্স + RLS policy (Supabase SQL Editor এ রান করুন)
```

## যা মূল HTML ভার্সনের মতোই রাখা হয়েছে

- candidates ↔ medicals/mofas/visas এর মধ্যে **deep-link**: candidates পেজের কোনো candidate এর Medical/Mofa/Visa পিল/বাটনে ক্লিক করলে সেই পেজে গিয়ে candidate প্রি-সিলেক্ট অথবা সার্চ হয়ে যায় (`?candidate_id=...&name=...&passport=...&action=add` প্যাটার্নে — Next.js এ `useSearchParams()` দিয়ে হ্যান্ডেল করা হয়েছে)
- সফট-ডিলিট (candidates: `is_deleted = true`), হার্ড-ডিলিট (medicals/mofas/visas)
- Mofa/Med toggle বাটন টেবিল থেকেই (mofa_update / med_update)
- pipeline পেজ এখনো ওই SQL view ব্যবহার করছে, তাই dashboard/candidates এর চেয়ে অনেক ফাস্ট

## যা এখনো বাকি / future কাজের জন্য নোট

- candidates পেজে **bulk multi-select + bulk Add Medical/Mofa/Visa** এবং **3-dot action menu** আগের HTML ভার্সনে ছিল, কিন্তু এই Next.js কনভার্সনে সিম্পল রাখা হয়েছে (single Edit/Delete বাটন + stage pill লিংক) — সময় বাঁচানোর জন্য। চাইলে `app/candidates/page.tsx` এ আগের bulk-select লজিক একইভাবে state ও modal দিয়ে যুক্ত করা যাবে।
- dashboard এ chart (মাসিক bar chart, donut chart) এখনো নেই — চাইলে `react-chartjs-2` বা `recharts` ইনস্টল করে যুক্ত করা যাবে।
- Finger, PC, Manpower, Flight, Iqamah, Agency CRUD পেজ এখনো বাকি — candidates/medicals/mofas/visas এর প্যাটার্ন কপি করেই বানানো যাবে (CandidatePicker, Modal, Pagination সব reusable)।
- এখনও সব table এর RLS policy `anon` role এর জন্য খোলা (পুরনো HTML ভার্সনের মতোই) — production এ যাওয়ার আগে Supabase Auth + role-based RLS যুক্ত করা উচিত।

## Deploy

Vercel এ deploy করতে চাইলে:
```bash
npm install -g vercel
vercel
```
Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) Vercel ড্যাশবোর্ডে বসিয়ে দিতে হবে।

-- ============================================================
-- ERP PIPELINE SETUP — candidate_pipeline view + audit columns
-- Supabase SQL Editor এ এই পুরো ফাইলটা একসাথে রান করুন
-- ============================================================

-- ------------------------------------------------------------
-- ১. পারফরম্যান্সের জন্য ইনডেক্স (লুকআপ আরও ফাস্ট হবে)
-- ------------------------------------------------------------
create index if not exists idx_medicals_candidate_id on public.medicals (candidate_id);
create index if not exists idx_medicals_created_at on public.medicals (created_at desc);

create index if not exists idx_visas_candidate_id on public.visas (candidate_id);
create index if not exists idx_visas_created_at on public.visas (created_at desc);

create index if not exists idx_mofas_candidate on public.mofas (candidate);
create index if not exists idx_mofas_sl on public.mofas (sl desc);

create index if not exists idx_candidates_agent on public.candidates (agent);
create index if not exists idx_candidates_received_date on public.candidates (received_date);


-- ------------------------------------------------------------
-- ২. অডিট কলাম যুক্ত করা (যেগুলোতে এখনো নেই)
--    candidates এ created_by আগে থেকেই আছে, created_at নেই — যুক্ত করছি
-- ------------------------------------------------------------
alter table public.candidates
  add column if not exists created_at timestamptz not null default now();

alter table public.candidates
  add column if not exists updated_at timestamptz not null default now();

alter table public.medicals
  add column if not exists updated_at timestamptz not null default now();

alter table public.mofas
  add column if not exists created_at timestamptz not null default now();

alter table public.mofas
  add column if not exists updated_at timestamptz not null default now();

alter table public.visas
  add column if not exists updated_at timestamptz not null default now();


-- ------------------------------------------------------------
-- ৩. updated_at স্বয়ংক্রিয়ভাবে আপডেট করার জন্য trigger function
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_candidates_updated_at on public.candidates;
create trigger trg_candidates_updated_at
  before update on public.candidates
  for each row execute function public.set_updated_at();

drop trigger if exists trg_medicals_updated_at on public.medicals;
create trigger trg_medicals_updated_at
  before update on public.medicals
  for each row execute function public.set_updated_at();

drop trigger if exists trg_mofas_updated_at on public.mofas;
create trigger trg_mofas_updated_at
  before update on public.mofas
  for each row execute function public.set_updated_at();

drop trigger if exists trg_visas_updated_at on public.visas;
create trigger trg_visas_updated_at
  before update on public.visas
  for each row execute function public.set_updated_at();


-- ------------------------------------------------------------
-- ৪. সবচেয়ে গুরুত্বপূর্ণ অংশ — candidate_pipeline VIEW
--    প্রতিটা candidate এর latest medical / mofa / visa এক জায়গায়
--    LATERAL JOIN ব্যবহার করায় এটা client-side loop করার চেয়ে অনেক ফাস্ট
-- ------------------------------------------------------------
create or replace view public.candidate_pipeline as
select
  c.id                   as candidate_id,
  c.sl                   as candidate_sl,
  c.name,
  c.passport_no,
  c.country,
  c.received_date,
  c.agent                as agent_id,
  ag.full_name           as agent_name,
  ag."CODE"              as agent_code,
  c.scan_copy,

  -- Medical (latest)
  m.id                   as medical_id,
  m.status               as medical_status,
  m.medical_date,
  m.fit_date,
  m.mofa_update,

  -- Mofa (latest)
  mf.id                  as mofa_id,
  mf.application_number  as mofa_application_number,
  mf.aplication_date     as mofa_application_date,
  mf.trade               as mofa_trade,
  mf.agency              as mofa_agency_id,
  mf.med_update          as mofa_med_update,

  -- Visa (latest)
  v.id                   as visa_id,
  v.status               as visa_status,
  v.visa_type,
  v.issue_date           as visa_issue_date,
  v.expiry_date          as visa_expiry_date,
  v.flight_date,
  v.iqamah_number,
  v.agency               as visa_agency_id,
  vag.name               as visa_agency_name,

  -- বর্তমানে candidate কোন স্টেজে আছে (ড্যাশবোর্ড/ফিল্টারের জন্য সহজ লেবেল)
  case
    when v.status in ('APPROVED','USED') then 'Visa Approved'
    when v.id is not null then 'Visa Stage'
    when mf.id is not null then 'Mofa Stage'
    when m.status = 'FIT' then 'Medical Done'
    when m.id is not null then 'Medical Stage'
    else 'New / Received'
  end as current_stage,

  -- দ্রুত critical-check এর জন্য কিছু প্রস্তুত করা ফ্ল্যাগ
  (v.expiry_date is not null and v.expiry_date <= (current_date + interval '30 days') and v.expiry_date >= current_date) as visa_expiring_soon,
  (v.expiry_date is not null and v.expiry_date < current_date) as visa_expired,
  (m.status in ('UNFIT','EXPIRED')) as medical_critical,
  (m.status = 'FIT' and coalesce(m.mofa_update, false) = false) as mofa_pending_after_fit_medical

from public.candidates c
left join public.agents ag on ag.id = c.agent
left join lateral (
  select * from public.medicals
  where candidate_id = c.id
  order by created_at desc
  limit 1
) m on true
left join lateral (
  select * from public.mofas
  where candidate = c.id
  order by sl desc
  limit 1
) mf on true
left join lateral (
  select * from public.visas
  where candidate_id = c.id
  order by created_at desc
  limit 1
) v on true
left join public.agency vag on vag.uuid = v.agency
where c.is_deleted = false;


-- ------------------------------------------------------------
-- ৫. View থেকে select করার জন্য RLS policy
--    (Views নিজে RLS এর আওতায় পড়ে না, কিন্তু underlying টেবিলে RLS থাকলেই কাজ করবে।
--     তাই candidates/medicals/mofas/visas/agents/agency টেবিলে select policy
--     অবশ্যই থাকতে হবে — যেগুলো আগেই দেওয়া হয়েছে)
-- ------------------------------------------------------------

-- নিশ্চিত করার জন্য (যদি আগে policy না দেওয়া থাকে):
alter table public.candidates enable row level security;
alter table public.medicals enable row level security;
alter table public.mofas enable row level security;
alter table public.visas enable row level security;
alter table public.agents enable row level security;
alter table public.agency enable row level security;

drop policy if exists "anon select candidates" on public.candidates;
create policy "anon select candidates" on public.candidates for select to anon using (true);

drop policy if exists "anon select medicals" on public.medicals;
create policy "anon select medicals" on public.medicals for select to anon using (true);

drop policy if exists "anon select mofas" on public.mofas;
create policy "anon select mofas" on public.mofas for select to anon using (true);

drop policy if exists "anon select visas" on public.visas;
create policy "anon select visas" on public.visas for select to anon using (true);

drop policy if exists "anon select agents" on public.agents;
create policy "anon select agents" on public.agents for select to anon using (true);

drop policy if exists "anon select agency" on public.agency;
create policy "anon select agency" on public.agency for select to anon using (true);


-- ------------------------------------------------------------
-- ৬. টেস্ট করুন
-- ------------------------------------------------------------
-- select * from public.candidate_pipeline limit 20;
-- select * from public.candidate_pipeline where visa_expiring_soon = true;
-- select * from public.candidate_pipeline where medical_critical = true;
-- select current_stage, count(*) from public.candidate_pipeline group by current_stage;

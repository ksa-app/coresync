import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// একই client সব জায়গায় reuse হবে (singleton)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// টেবিল/ভিউ নামগুলো এক জায়গায় রাখা — ভবিষ্যতে বদলাতে সুবিধা হবে
export const TABLES = {
  candidates: "candidates",
  agents: "agents",
  agency: "agency",
  medicals: "medicals",
  mofas: "mofas",
  visas: "visas",
  pipelineView: "candidate_pipeline",
} as const;

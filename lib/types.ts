export type Candidate = {
  id: string;
  sl: number | null;
  name: string;
  passport_no: string;
  received_date: string | null;
  agent: string | null;
  scan_copy: string | null;
  is_deleted: boolean | null;
  country: string | null;
  created_at?: string;
};

export type Agent = {
  id: string;
  full_name: string;
  CODE: string | null;
};

export type Agency = {
  uuid: string;
  name: string | null;
  rl: number | null;
};

export type MedicalStatus = "N/A" | "NEW" | "FIT" | "UNFIT" | "USED" | "EXPIRED";

export type Medical = {
  id: string;
  candidate_id: string;
  sl: number;
  medical_date: string | null;
  fit_date: string | null;
  status: MedicalStatus | null;
  mofa_update: boolean | null;
  created_at: string;
  candidates?: { id: string; name: string; passport_no: string };
};

export type Mofa = {
  id: string;
  sl: number;
  candidate: string;
  application_number: string | null;
  agency: string | null;
  med_update: boolean | null;
  trade: string | null;
  aplication_date: string | null;
  candidates?: { id: string; name: string; passport_no: string };
};

export type VisaStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "USED";

export type Visa = {
  id: string;
  candidate_id: string;
  visa_sl: number;
  issue_date: string | null;
  expiry_date: string | null;
  flight_date: string | null;
  visa_type: string | null;
  iqamah_number: string | null;
  status: VisaStatus | null;
  created_at: string;
  agency: string | null;
  candidates?: { id: string; name: string; passport_no: string };
};

// candidate_pipeline ভিউ এর শেপ (pipeline_setup.sql দেখুন)
export type PipelineRow = {
  candidate_id: string;
  candidate_sl: number | null;
  name: string;
  passport_no: string;
  country: string | null;
  received_date: string | null;
  agent_id: string | null;
  agent_name: string | null;
  agent_code: string | null;
  scan_copy: string | null;

  medical_id: string | null;
  medical_status: MedicalStatus | null;
  medical_date: string | null;
  fit_date: string | null;
  mofa_update: boolean | null;

  mofa_id: string | null;
  mofa_application_number: string | null;
  mofa_application_date: string | null;
  mofa_trade: string | null;
  mofa_agency_id: string | null;
  mofa_med_update: boolean | null;

  visa_id: string | null;
  visa_status: VisaStatus | null;
  visa_type: string | null;
  visa_issue_date: string | null;
  visa_expiry_date: string | null;
  flight_date: string | null;
  iqamah_number: string | null;
  visa_agency_id: string | null;
  visa_agency_name: string | null;

  current_stage: string;
  visa_expiring_soon: boolean;
  visa_expired: boolean;
  medical_critical: boolean;
  mofa_pending_after_fit_medical: boolean;
};

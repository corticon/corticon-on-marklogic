export interface EligibilityDetermination {
  id: string;
  application_id: string;
  applicant_name: string;
  date_of_birth: string;
  ssn_last_four?: string;
  determination_date: string;
  application_date: string;
  status: 'approved' | 'denied' | 'pending' | 'under_review';
  eligibility_category: 'children' | 'pregnant_women' | 'parents' | 'elderly' | 'disabled' | 'other';
  income_level: number;
  household_size: number;
  fpl_percentage: number;
  state: string;
  county: string;
  zip_code: string;
  denial_reasons: string[];
  case_worker_id?: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsData {
  totalApplications: number;
  approvalRate: number;
  denialRate: number;
  pendingCount: number;
  commonDenialReasons: { reason: string; count: number }[];
  byState: { state: string; count: number }[];
  byCategory: { category: string; count: number }[];
  avgProcessingTime: number;
}

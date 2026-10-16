export interface AdmissionProfile {
  name: string; school: string; grade: string; gender: string; birth_six: string; phone: string;
  father_name: string; mother_name: string; father_phone: string; mother_phone: string;
  primary_parent: 'father' | 'mother'; enrollment_date: string; consent: boolean;
}
export interface AdmissionTerms {
  enrollment_date: string; monthly_tuition: number; discount_rate: number;
  class_days: number[]; time_slot: string;
}
export interface AdmissionQuote extends AdmissionTerms {
  year_month: string; total_classes: number; remaining_classes: number; class_dates: string[];
  prorated_amount: number; discount_amount: number; final_amount: number;
}
export interface AdmissionPreview {
  terms: AdmissionTerms; quote: AdmissionQuote; preview_hash: string; duplicate_student_ids: number[];
}
export interface AdmissionApplication {
  id: number; status: 'submitted' | 'scheduled' | 'enrolled' | 'cancelled' | 'review'; revision: number;
  profile: AdmissionProfile; enrollment_date: string | null; terms: AdmissionTerms | null;
  quote: AdmissionQuote | null; student_id: number | null; review_code: string | null; created_at: string;
}

import type { RestCredit } from '@/lib/types/student';

export interface ManualCreditModalProps {
  open: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
  monthlyTuition: number;
  weeklyCount: number;
  classDays: number[];
  onSuccess: () => void;
}

export type ManualCredit = RestCredit;
export type MainTab = 'create' | 'manage';
export type CreditInputMode = 'date' | 'count' | 'amount';

export interface DateCreditCalculation {
  count: number;
  dates: string[];
  totalCredit: number;
}

export interface CreditCalculation {
  count: number;
  totalCredit: number;
}

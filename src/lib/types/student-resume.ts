import type { Student } from './student';

export interface RestCreditRecalculation {
  adjusted: boolean;
  creditId: number;
  creditType: 'carryover' | 'refund';
  previousAmount: number;
  creditAmount: number;
  remainingAmount: number;
  usedAmount: number;
  restStartDate: string;
  restEndDate: string;
  restDays: number;
  status: 'pending' | 'partial' | 'applied' | 'refunded' | 'cancelled';
}

export interface StudentResumeResponse {
  message: string;
  student: Student;
  scheduleAssigned: {
    assigned: number;
    created: number;
  } | null;
  paymentCreated: {
    id: number;
    yearMonth: string;
    baseAmount: number;
    finalAmount: number;
    remainingClassDays: number;
    totalClassDays: number;
  } | null;
  creditRecalculation: RestCreditRecalculation | null;
  resumeDate: string;
}

/**
 * Common Type Definitions
 * 공통 타입 정의 - DB 스키마와 일치
 *
 * 주의: Student, Instructor 관련 상세 타입은 각각의 파일 참조
 * - @/lib/types/student
 * - @/lib/types/instructor
 */

// ===== Common Types =====

export interface APIResponse<T> {
  message: string;
  data?: T;
  error?: string;
}

// ===== Student Types (DB 스키마 기반) =====

export type StudentStatus = 'active' | 'paused' | 'graduated' | 'withdrawn' | 'trial' | 'pending';
export type StudentType = 'exam' | 'adult';
export type Grade = '고1' | '고2' | '고3' | 'N수';
export type AdmissionType = 'regular' | 'early' | 'civil_service';

// ===== Instructor Types (DB 스키마 기반) =====

export type SalaryType = 'hourly' | 'per_class' | 'monthly' | 'mixed';
export type TaxType = '3.3%' | 'insurance' | 'none';
export type InstructorStatus = 'active' | 'on_leave' | 'retired';

// ===== Schedule Types =====

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type TimeSlot = 'morning' | 'afternoon' | 'evening';

// ===== Payment Types =====

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type PaymentMethod = 'account' | 'card' | 'cash' | 'other';

// ===== Performance Types =====

export type RecordType = 'mock_exam' | 'physical' | 'competition';

// ===== Student =====

export interface Student {
  id: number;
  academy_id: number;
  student_number: string | null;
  name: string;
  student_type: StudentType;
  phone: string | null;
  parent_phone: string | null;
  school: string | null;
  grade: Grade | null;
  age: number | null;
  address: string | null;
  admission_type: AdmissionType;
  profile_image_url: string | null;
  class_days: number[] | string;
  weekly_count: number;
  monthly_tuition: string;
  discount_rate: string;
  final_monthly_tuition: string | null;
  is_season_registered: boolean;
  current_season_id: number | null;
  status: StudentStatus;
  enrollment_date: string | null;
  withdrawal_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateStudentInput {
  name: string;
  student_type: StudentType;
  phone: string;
  parent_phone?: string;
  school?: string;
  grade?: Grade;
  age?: number;
  address?: string;
  admission_type: AdmissionType;
  class_days: number[];
  weekly_count: number;
  monthly_tuition: number;
  discount_rate?: number;
  enrollment_date?: string;
  notes?: string;
}

// ===== Instructor =====

export interface Instructor {
  id: number;
  academy_id: number;
  user_id: number | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  birth_date: string | null;
  resident_number: string | null;
  hire_date: string | null;
  salary_type: SalaryType;
  base_salary: string;
  hourly_rate: string;
  morning_class_rate: string;
  afternoon_class_rate: string;
  evening_class_rate: string;
  incentive_rate: string;
  tax_type: TaxType;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  status: InstructorStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ===== Schedule =====

export interface ClassSchedule {
  id: number;
  academy_id: number;
  class_date: string;
  time_slot: TimeSlot;
  instructor_id: number | null;
  instructor_name?: string;
  title: string | null;
  content: string | null;
  attendance_taken: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: number;
  class_schedule_id: number;
  student_id: number;
  student_name?: string;
  attendance_status: AttendanceStatus;
  notes: string | null;
  recorded_at: string;
}

// ===== Payment =====

export interface Payment {
  id: number;
  student_id: number;
  student_name?: string;
  year_month: string;
  base_amount: string;
  discount_amount: string;
  final_amount: string;
  paid_amount: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  paid_date: string | null;
  due_date: string;
  notes: string | null;
  created_at: string;
}

// ===== Salary =====

export interface Salary {
  id: number;
  instructor_id: number;
  instructor_name?: string;
  year_month: string;
  morning_classes: number;
  afternoon_classes: number;
  evening_classes: number;
  base_salary: string;
  bonus: string | null;
  deduction: string | null;
  tax_amount: string;
  final_salary: string;
  payment_status: 'unpaid' | 'paid';
  payment_date: string | null;
  notes: string | null;
  created_at: string;
}

// ===== Performance =====

export interface Performance {
  id: number;
  student_id: number;
  record_date: string;
  record_type: RecordType;
  performance_data: MockExamData | PhysicalData | CompetitionData;
  notes: string | null;
  created_at: string;
}

export interface MockExamData {
  subjects: Array<{
    name: string;
    score: number;
    max_score: number;
  }>;
  rank?: number;
  total_students?: number;
}

export interface PhysicalData {
  events: Array<{
    name: string;
    record: number;
    unit: string;
  }>;
}

export interface CompetitionData {
  name: string;
  result: string;
  record?: string;
}

// ===== Expense =====

export interface Expense {
  id: number;
  expense_date: string;
  category: string;
  amount: string;
  salary_id: number | null;
  instructor_id: number | null;
  instructor_name?: string;
  description: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  recorded_by: number;
  recorded_by_name?: string;
  created_at: string;
}

// ===== Dashboard =====

export interface DashboardStats {
  students: {
    total_students: number;
    active_students: string;
    paused_students: string;
  };
  instructors: {
    total_instructors: number;
    active_instructors: string;
  };
  current_month: {
    month: string;
    revenue: {
      count: number;
      amount: number;
    };
    expenses: {
      count: number;
      amount: number;
    };
    net_income: number;
  };
  unpaid_payments: {
    count: number;
    amount: number;
  };
  rest_ended_students?: {
    count: number;
  };
}

// ===== Reports =====

export interface FinancialReport {
  year_month: string;
  revenue: {
    total: number;
    breakdown: Array<{
      category: string;
      count: number;
      amount: number;
    }>;
  };
  expenses: {
    total: number;
    breakdown: Array<{
      category: string;
      count: number;
      amount: number;
    }>;
  };
  net_income: number;
}

export interface AttendanceReport {
  period: {
    start_date: string;
    end_date: string;
  };
  overall: {
    total_records: number;
    present_count: string;
    attendance_rate: number;
  };
  by_student: Array<{
    student_id: number;
    student_name: string;
    total_days: number;
    present_days: string;
    attendance_rate: string;
  }>;
}

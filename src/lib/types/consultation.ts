// 상담 예약 관련 타입 정의

export type ConsultationType = 'new_registration' | 'learning';
export type ConsultationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type LearningType = 'regular' | 'admission' | 'parent' | 'counseling';

// 체크리스트 입력 필드 타입
export interface ChecklistInput {
  type: 'text' | 'radio';
  label: string;
  value: string;
  options?: string[]; // radio 타입일 때 사용
}

// 체크리스트 항목 타입
export interface ChecklistItem {
  id: number;
  category: string;
  text: string;
  checked: boolean;
  input?: ChecklistInput;
  inputs?: ChecklistInput[];
}

// 체크리스트 템플릿 (설정에서 관리)
export interface ChecklistTemplate {
  id: number;
  category: string;
  text: string;
  input?: Omit<ChecklistInput, 'value'> & { value?: string };
  inputs?: (Omit<ChecklistInput, 'value'> & { value?: string })[];
}

export type StudentGrade =
  | '중3'
  | '고1' | '고2' | '고3'
  | 'N수' | '성인';

// 성적 정보
export interface AcademicScores {
  // 새 구조 (v2.5.10+): 상담 신청 폼에서 사용
  mockTestGrades?: {
    korean?: number;
    math?: number;
    english?: number;
    exploration?: number;
  };
  schoolGradeAvg?: number;  // 내신 평균등급 (-1: 미응시)
  admissionType?: string;   // 입시 유형 (수시/정시)

  // 기존 구조 (호환성 유지)
  school_grades?: {
    korean?: number;
    math?: number;
    english?: number;
    exploration?: number;
  };
  mock_exam_grades?: {
    korean?: number;
    math?: number;
    english?: number;
    exploration?: number;
  };
  percentiles?: {
    korean?: number;
    math?: number;
    english?: number;
    exploration?: number;
  };
}

// 상담 — backend fields from consultations table
export interface Consultation {
  id: number;
  academy_id: number;

  // Backend core fields (from _decrypt_consultation)
  student_name: string | null;
  student_phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  date: string; // YYYY-MM-DD (backend field)
  time: string; // HH:MM (backend field)
  status: ConsultationStatus;
  notes: string | null; // backend field (admin memo)
  source: string | null; // online|phone|walk_in
  linked_student_id: number | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;

  // Aliases — populated by API mapper for backward compatibility with components
  preferred_date: string; // = date
  preferred_time: string; // = time
  admin_notes?: string; // = notes

  // Frontend-extended fields (not in backend yet — used by components)
  consultation_type?: ConsultationType;
  learning_type?: LearningType;
  student_grade?: StudentGrade;
  student_school?: string;
  gender?: 'male' | 'female';
  academic_scores?: AcademicScores;
  academicScores?: AcademicScores;
  target_school?: string;
  referrer_student?: string;
  referral_sources?: string[];
  referralSources?: string[];
  inquiry_content?: string;
  linked_student_name?: string;
  linked_student_grade?: string;
  linked_student_is_trial?: boolean;
  matched_student_status?: 'registered_with_trial' | 'registered_direct' | 'trial_ongoing' | 'trial_completed' | 'no_trial';
  checklist?: ChecklistItem[];
  consultation_memo?: string;
  alimtalk_sent_at?: string;
  alimtalk_status?: string;
}

// 모의고사 등급 (과목별)
export interface MockTestGrades {
  korean?: number;
  math?: number;
  english?: number;
  exploration?: number;
}

// 상담 신청 폼 데이터 (공개 페이지용)
export interface ConsultationFormData {
  consultationType: ConsultationType;
  parentName: string;
  parentPhone: string;
  studentName: string;
  studentPhone?: string;
  studentGrade?: StudentGrade;
  studentSchool?: string;
  gender?: 'male' | 'female';
  schoolGrade?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  mockTestGrade?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  mockTestGrades?: MockTestGrades;
  schoolGradeAvg?: number;
  admissionType?: string;
  academicScores?: AcademicScores;
  targetSchool?: string;
  referrerStudent?: string;
  referralSource?: string;
  inquiryContent?: string;
  preferredDate?: string;
  preferredTime?: string;
}

// 요일별 운영 시간
export interface WeeklyHour {
  dayOfWeek: number; // 0=일, 1=월, ..., 6=토
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
}

// Blocked slot (stored as JSON in consultation_settings.blocked_slots)
export interface BlockedSlot {
  id: number;
  date: string; // backend field name
  start_time: string;
  end_time: string;
  reason?: string;
  // Aliases for backward compat
  blocked_date?: string; // = date
}

// Settings update request — maps to ConsultationSettingsUpdate on backend
export interface ConsultationSettingsUpdate {
  slug?: string;
  is_active?: boolean;
  academy_name_display?: string;
  description?: string;
  duration_minutes?: number;
  max_per_slot?: number;
  fields?: Record<string, boolean>;
  notify_on_new?: boolean;
  notify_email?: string;
}

// 공개 페이지 정보 (API 응답 구조)
export interface ConsultationPageInfo {
  academy: {
    id: number;
    name: string;
    slug: string;
  };
  settings: {
    pageTitle?: string;
    pageDescription?: string;
    slotDuration: number;
    advanceDays: number;
    referralSources?: string[];
  };
  weeklyHours: WeeklyHour[];
}

// 시간 슬롯
export interface TimeSlot {
  time: string; // HH:MM 형식
  available: boolean;
  reason?: 'blocked' | 'fully_booked' | 'past' | null;
}

// API responses — backend returns flat data
// GET /consultations → Consultation[] directly
// GET /consultations/{id} → Consultation directly
// GET /consultations/settings → flat settings object with parsed JSON fields

export interface SlotsResponse {
  date: string;
  slots: TimeSlot[];
  slotDuration: number;
}

// GET /consultations/settings returns flat ConsultationSettings columns with parsed JSON
export interface ConsultationSettingsResponse {
  id: number;
  academy_id: number;
  slug: string | null;
  is_active: boolean;
  academy_name_display: string | null;
  description: string | null;
  duration_minutes: number;
  max_per_slot: number;
  weekly_hours: Record<string, string[]> | null; // parsed JSON
  blocked_slots: Array<{ id: number; date: string; start_time: string; end_time: string; reason?: string }> | null;
  fields: Record<string, boolean> | null; // parsed JSON
  notify_on_new: boolean;
  notify_email: string | null;
}

// 상담 유형 라벨
export const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
  new_registration: '신규 상담',
  learning: '재원생 상담'
};

// 재원생 상담 유형 라벨
export const LEARNING_TYPE_LABELS: Record<LearningType, string> = {
  regular: '정기상담',
  admission: '진학상담',
  parent: '학부모상담',
  counseling: '고민상담'
};

// 상담 상태 라벨
export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, string> = {
  pending: '대기중',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
  no_show: '노쇼'
};

// 상태별 색상
export const CONSULTATION_STATUS_COLORS: Record<ConsultationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  no_show: 'bg-red-100 text-red-800'
};

// 학년 목록 (체대입시 학원 - 중3부터)
export const GRADE_OPTIONS: StudentGrade[] = [
  '중3',
  '고1', '고2', '고3',
  'N수', '성인'
];

// 요일 라벨
export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 월요일부터 시작하는 요일 순서 (월~일)
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 월, 화, 수, 목, 금, 토, 일

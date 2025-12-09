// 상담 예약 관련 타입 정의

export type ConsultationType = 'new_registration' | 'learning';
export type ConsultationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

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

// 상담 신청
export interface Consultation {
  id: number;
  academy_id: number;
  consultation_type: ConsultationType;

  // 학부모 정보
  parent_name: string;
  parent_phone: string;

  // 학생 정보
  student_name: string;
  student_phone?: string;
  student_grade: StudentGrade;
  student_school?: string;

  // 성적 정보
  academic_scores?: AcademicScores;
  academicScores?: AcademicScores; // API 응답용

  // 기타 정보
  target_school?: string;
  referrer_student?: string;
  referral_sources?: string[];
  referralSources?: string[]; // API 응답용
  inquiry_content?: string;

  // 일정
  preferred_date: string;
  preferred_time: string;

  // 연결된 학생
  linked_student_id?: number;
  linked_student_name?: string;
  linked_student_grade?: string;
  linked_student_is_trial?: boolean;

  // 상태
  status: ConsultationStatus;
  admin_notes?: string;

  // 상담 진행
  checklist?: ChecklistItem[];
  consultation_memo?: string;

  // 알림톡
  alimtalk_sent_at?: string;
  alimtalk_status?: string;

  created_at: string;
  updated_at: string;
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

// 차단된 시간대
export interface BlockedSlot {
  id: number;
  blocked_date: string;
  is_all_day: boolean;
  start_time?: string;
  end_time?: string;
  reason?: string;
  created_at: string;
}

// 상담 설정
export interface ConsultationSettings {
  isEnabled: boolean;
  pageTitle: string;
  pageDescription: string;
  slotDuration: number;
  maxReservationsPerSlot: number;
  advanceDays: number;
  referralSources: string[];
  sendConfirmationAlimtalk: boolean;
  confirmationTemplateCode: string;
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

// API 응답들
export interface ConsultationListResponse {
  consultations: Consultation[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: {
    pending?: number;
    confirmed?: number;
    completed?: number;
    cancelled?: number;
    no_show?: number;
  };
}

export interface SlotsResponse {
  date: string;
  slots: TimeSlot[];
  slotDuration: number;
}

export interface SettingsResponse {
  academy?: {
    id: number;
    name: string;
    slug?: string;
  };
  settings?: Partial<ConsultationSettings>;
  weeklyHours?: WeeklyHour[];
  blockedSlots?: BlockedSlot[];
}

// 상담 유형 라벨
export const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
  new_registration: '신규 등록 상담',
  learning: '학습 상담'
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

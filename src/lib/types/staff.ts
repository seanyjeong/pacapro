/**
 * 직원 관리 타입 정의
 */

// 페이지별 권한
export interface PagePermission {
  view: boolean;
  edit: boolean;
}

// 전체 권한 구조
export interface Permissions {
  // 학원 운영
  students?: PagePermission;
  instructors?: PagePermission;
  schedules?: PagePermission;
  academy_events?: PagePermission;  // 학원일정
  seasons?: PagePermission;
  // 재무 관리
  payments?: PagePermission;
  salaries?: PagePermission;
  expenses?: PagePermission;
  incomes?: PagePermission;
  reports?: PagePermission;
  // 커뮤니케이션
  consultations?: PagePermission;  // 상담
  sms?: PagePermission;  // 문자 보내기
  notifications?: PagePermission;  // 알림톡 설정
  // 관리
  settings?: PagePermission;
  staff?: PagePermission;
  // 대시보드 세부 권한
  dashboard_finance?: PagePermission;  // 수입, 지출, 순수익
  dashboard_unpaid?: PagePermission;   // 미수금 현황
  // 세부 기능 권한
  overtime_approval?: PagePermission;  // 초과근무 승인
}

// 직원 정보
export interface Staff {
  id: number;
  email: string;
  name: string;
  position: string | null;
  permissions: Permissions;
  instructor_id: number | null;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
  instructor_name?: string;
  instructor_phone?: string;
  instructor_type?: string;
}

// 권한 부여 가능한 강사
export interface AvailableInstructor {
  id: number;
  name: string;
  phone: string;
  status: string;
  instructor_type: string;
}

// 직원 생성 요청
export interface CreateStaffRequest {
  instructor_id: number;
  email: string;
  password: string;
  position?: string;
  permissions?: Permissions;
}

// 직원 수정 요청
export interface UpdateStaffRequest {
  position?: string;
  permissions?: Permissions;
  password?: string;
  is_active?: boolean;
}

// 페이지 권한 정보 (UI용)
export interface PermissionPage {
  key: string;
  label: string;
  description: string;
}

// 기본 권한 (모든 권한 없음)
export const DEFAULT_PERMISSIONS: Permissions = {
  // 학원 운영
  students: { view: false, edit: false },
  instructors: { view: false, edit: false },
  schedules: { view: false, edit: false },
  academy_events: { view: false, edit: false },
  seasons: { view: false, edit: false },
  // 재무 관리
  payments: { view: false, edit: false },
  salaries: { view: false, edit: false },
  expenses: { view: false, edit: false },
  incomes: { view: false, edit: false },
  reports: { view: false, edit: false },
  // 커뮤니케이션
  consultations: { view: false, edit: false },
  sms: { view: false, edit: false },
  notifications: { view: false, edit: false },
  // 관리
  settings: { view: false, edit: false },
  staff: { view: false, edit: false },
  // 대시보드 세부 권한
  dashboard_finance: { view: false, edit: false },
  dashboard_unpaid: { view: false, edit: false },
  // 세부 기능 권한
  overtime_approval: { view: false, edit: false },
};

// 페이지 권한 카테고리 구조 (사이드바와 동일)
export interface PermissionCategory {
  title: string;
  items: PermissionPage[];
}

// 페이지 목록 (UI용) - 카테고리별 구조
export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    title: '대시보드',
    items: [
      { key: 'dashboard_finance', label: '매출 현황', description: '수입, 지출, 순수익 보기' },
      { key: 'dashboard_unpaid', label: '미수금 현황', description: '미수금 현황 보기' },
    ],
  },
  {
    title: '학원 운영',
    items: [
      { key: 'students', label: '학생', description: '학생 목록, 등록, 수정' },
      { key: 'instructors', label: '강사', description: '강사 목록, 등록' },
      { key: 'schedules', label: '수업스케줄', description: '시간표, 출결' },
      { key: 'academy_events', label: '학원일정', description: '학원 일정 관리' },
      { key: 'seasons', label: '시즌', description: '수시/정시 시즌' },
    ],
  },
  {
    title: '재무 관리',
    items: [
      { key: 'payments', label: '학원비', description: '수납 관리' },
      { key: 'salaries', label: '급여', description: '강사 급여' },
      { key: 'overtime_approval', label: '초과근무 승인', description: '강사 초과근무 요청 승인' },
      { key: 'expenses', label: '지출', description: '지출 기록' },
      { key: 'incomes', label: '수입', description: '기타 수입 기록' },
      { key: 'reports', label: '리포트', description: '수입/지출 리포트' },
    ],
  },
  {
    title: '커뮤니케이션',
    items: [
      { key: 'consultations', label: '상담', description: '상담 관리' },
      { key: 'sms', label: '문자 보내기', description: 'SMS 발송' },
      { key: 'notifications', label: '알림톡 설정', description: '알림톡 템플릿 설정' },
    ],
  },
  {
    title: '관리',
    items: [
      { key: 'settings', label: '설정', description: '학원 설정' },
      { key: 'staff', label: '직원 관리', description: '관리자 추가/권한 설정' },
    ],
  },
];

// 하위 호환성을 위한 플랫 리스트
export const PERMISSION_PAGES: PermissionPage[] = PERMISSION_CATEGORIES.flatMap(cat => cat.items);

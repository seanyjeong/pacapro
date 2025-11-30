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
  students?: PagePermission;
  instructors?: PagePermission;
  payments?: PagePermission;
  salaries?: PagePermission;
  schedules?: PagePermission;
  reports?: PagePermission;
  expenses?: PagePermission;
  incomes?: PagePermission;
  seasons?: PagePermission;
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
  students: { view: false, edit: false },
  instructors: { view: false, edit: false },
  payments: { view: false, edit: false },
  salaries: { view: false, edit: false },
  schedules: { view: false, edit: false },
  reports: { view: false, edit: false },
  expenses: { view: false, edit: false },
  incomes: { view: false, edit: false },
  seasons: { view: false, edit: false },
  settings: { view: false, edit: false },
  staff: { view: false, edit: false },
  dashboard_finance: { view: false, edit: false },
  dashboard_unpaid: { view: false, edit: false },
  overtime_approval: { view: false, edit: false },
};

// 페이지 목록 (UI용)
export const PERMISSION_PAGES: PermissionPage[] = [
  { key: 'dashboard_finance', label: '대시보드 - 매출', description: '수입, 지출, 순수익 보기' },
  { key: 'dashboard_unpaid', label: '대시보드 - 미수금', description: '미수금 현황 보기' },
  { key: 'students', label: '학생 관리', description: '학생 목록, 등록, 수정' },
  { key: 'instructors', label: '강사 관리', description: '강사 목록, 등록' },
  { key: 'payments', label: '학원비', description: '수납 관리' },
  { key: 'salaries', label: '급여 관리', description: '강사 급여' },
  { key: 'schedules', label: '스케줄', description: '시간표, 출결' },
  { key: 'overtime_approval', label: '초과근무 승인', description: '강사 초과근무 요청 승인' },
  { key: 'reports', label: '리포트', description: '수입/지출 리포트' },
  { key: 'expenses', label: '지출 관리', description: '지출 기록' },
  { key: 'incomes', label: '기타수입', description: '기타 수입 기록' },
  { key: 'seasons', label: '시즌 관리', description: '수시/정시 시즌' },
  { key: 'settings', label: '설정', description: '학원 설정' },
  { key: 'staff', label: '직원 관리', description: '관리자 추가/권한 설정' },
];

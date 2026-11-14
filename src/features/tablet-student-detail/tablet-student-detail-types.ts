import type { Student } from '@/lib/types/student';
import type { StudentParentPhones } from '@/lib/types/student-parent-phones';

/** 사진 칸(`StudentAvatar`)에 쓰는 값. PC 학생 상세와 같은 `/students/:id` 응답에 들어 있다. */
type TabletStudentPhoto = Partial<Pick<Student, 'profile_image_url' | 'profile_image_key' | 'profile_thumb_key' | 'profile_image_updated_at'>>;

export interface TabletStudentDetail extends StudentParentPhones, TabletStudentPhoto {
  address: string | null;
  class_days: unknown;
  discount_rate: number | string;
  enrollment_date: string;
  final_monthly_tuition?: number | string | null;
  gender: string;
  grade: string;
  id: number;
  is_trial: boolean;
  memo: string | null;
  monthly_tuition: number | string;
  name: string;
  parent_phone: string | null;
  phone: string | null;
  school: string;
  status: string;
  student_type: string;
  trial_remaining: number;
}

export interface TabletAttendanceSummary {
  absent: number;
  present: number;
  rate: number;
  total: number;
}

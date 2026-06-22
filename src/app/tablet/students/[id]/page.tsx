'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useOrientation } from '@/components/tablet/orientation-context';
import apiClient from '@/lib/api/client';
import { formatTabletClassDays, formatTabletPhone, formatTabletWon } from '@/features/tablet-students/tablet-student-utils';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CreditCard,
  MessageSquare,
  Monitor,
  Phone,
  RefreshCw,
  User
} from 'lucide-react';

interface Student {
  id: number;
  name: string;
  grade: string;
  gender: string;
  school: string;
  phone: string | null;
  parent_phone: string | null;
  status: string;
  is_trial: boolean;
  trial_remaining: number;
  student_type: string;
  class_days: unknown;
  enrollment_date: string;
  monthly_tuition: number | string;
  final_monthly_tuition?: number | string | null;
  discount_rate: number | string;
  memo: string | null;
  address: string | null;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  rate: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: '재원', color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
  paused: { label: '휴원', color: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' },
  withdrawn: { label: '퇴원', color: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' },
  graduated: { label: '졸업', color: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  trial: { label: '체험', color: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' },
  pending: { label: '대기', color: 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300' },
};

export default function TabletStudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orientation = useOrientation();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchStudentData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const studentRes = await apiClient.get<{ student: Student }>(`/students/${studentId}`, {
        suppressErrorToast: true,
      });
      setStudent(studentRes.student);

      try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

        const attendanceRes = await apiClient.get<{
          schedules: Array<{
            attendances: Array<{
              student_id: number;
              attendance_status: string | null;
            }>;
          }>;
        }>('/schedules', {
          params: { start_date: startOfMonth, end_date: endOfMonth },
          suppressErrorToast: true,
        });

        let total = 0;
        let present = 0;
        let absent = 0;

        (attendanceRes.schedules || []).forEach(schedule => {
          (schedule.attendances || []).forEach(att => {
            if (att.student_id === parseInt(studentId)) {
              total++;
              if (att.attendance_status === 'present' || att.attendance_status === 'late') {
                present++;
              } else if (att.attendance_status === 'absent') {
                absent++;
              }
            }
          });
        });

        setAttendanceSummary({
          total,
          present,
          absent,
          rate: total > 0 ? Math.round((present / total) * 100) : 0
        });
      } catch {
        setAttendanceSummary(null);
      }
    } catch (error) {
      console.warn('Tablet student load failed', error);
      setStudent(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) void fetchStudentData();
  }, [fetchStudentData, studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <User size={44} className="mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">학생 정보를 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-muted-foreground">잠시 후 다시 시도해주세요.</p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
          >
            목록으로
          </button>
          <button
            type="button"
            onClick={() => void fetchStudentData()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            다시 불러오기
          </button>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-12">
        <User size={48} className="mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">학생 정보를 찾을 수 없습니다</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-xl"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const effectiveTuition = student.final_monthly_tuition || student.monthly_tuition;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-none">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <ArrowLeft size={20} />
          <span>목록으로</span>
        </button>

        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${
            student.gender === 'male' ? 'bg-blue-500/80 dark:bg-blue-600' : 'bg-pink-500/80 dark:bg-pink-600'
          }`}>
            {student.name.charAt(0)}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{student.name}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                STATUS_LABELS[student.status]?.color || 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'
              }`}>
                {STATUS_LABELS[student.status]?.label || student.status}
              </span>
              {!!student.is_trial && (
                <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 text-sm rounded-full">
                  체험 {student.trial_remaining}회 남음
                </span>
              )}
            </div>
            <p className="text-muted-foreground">{student.grade} · {student.school || '-'}</p>
          </div>
        </div>
      </div>

      <nav aria-label="학생 업무 바로가기" className="grid gap-2 rounded-lg border border-border bg-card p-3 shadow-none sm:grid-cols-4">
        <StudentActionLink href={`/tablet/payments?studentId=${student.id}`} label={`${student.name} 결제 확인`} icon={<CreditCard className="h-4 w-4" />}>
          결제 확인
        </StudentActionLink>
        <StudentActionLink href={`/tablet/sms?studentId=${student.id}&recipient=parent`} label={`${student.name} 문자 보내기`} icon={<MessageSquare className="h-4 w-4" />}>
          문자 보내기
        </StudentActionLink>
        <StudentActionLink href={`/tablet/attendance?studentId=${student.id}`} label={`${student.name} 출석 체크`} icon={<CheckCircle2 className="h-4 w-4" />}>
          출석 체크
        </StudentActionLink>
        <StudentActionLink href={`/students/${student.id}`} label={`${student.name} PC 상세 열기`} icon={<Monitor className="h-4 w-4" />}>
          PC 상세
        </StudentActionLink>
      </nav>

      {/* 요약 카드 */}
      <div className={`grid gap-4 ${orientation === 'landscape' ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {/* 출석 현황 */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-none">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="text-green-500 dark:text-green-400" size={20} />
            <h3 className="font-bold text-foreground">이번달 출석</h3>
          </div>
          {attendanceSummary ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">출석률</span>
                <span className="font-bold text-green-600 dark:text-green-400">{attendanceSummary.rate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">출석</span>
                <span className="text-slate-800 dark:text-slate-100">{attendanceSummary.present}회</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">결석</span>
                <span className="text-red-600 dark:text-red-400">{attendanceSummary.absent}회</span>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 dark:text-slate-500 text-sm">출석 정보 없음</p>
          )}
        </div>

        {/* 수업 정보 */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-none">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="font-bold text-foreground">수업 정보</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">수업 요일</span>
              <span className="text-foreground">{formatTabletClassDays(student.class_days)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">등록일</span>
              <span className="text-foreground">
                {student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString('ko-KR') : '-'}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-none">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="text-emerald-500" size={20} />
            <h3 className="font-bold text-foreground">결제 기준</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">실납부</span>
              <span className="font-bold text-foreground">{formatTabletWon(effectiveTuition)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">할인율</span>
              <span className="text-foreground">{Number(student.discount_rate || 0)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 연락처 */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-none">
        <h3 className="mb-4 font-bold text-foreground">연락처</h3>
        <div className="grid gap-4 grid-cols-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <Phone size={18} className="text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">학생</p>
              <p className="text-foreground">{formatTabletPhone(student.phone)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <Phone size={18} className="text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">학부모</p>
              <p className="text-foreground">{formatTabletPhone(student.parent_phone)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 메모 */}
      {student.memo && (
        <div className="rounded-lg border border-border bg-card p-5 shadow-none">
          <h3 className="mb-2 font-bold text-foreground">메모</h3>
          <p className="whitespace-pre-wrap text-muted-foreground">{student.memo}</p>
        </div>
      )}
    </div>
  );
}

function StudentActionLink({
  children,
  href,
  icon,
  label,
}: {
  children: ReactNode;
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      aria-label={label}
      href={href}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring/30"
    >
      {icon}
      {children}
    </Link>
  );
}

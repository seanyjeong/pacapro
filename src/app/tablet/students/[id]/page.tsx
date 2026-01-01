'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useOrientation } from '@/components/tablet/orientation-context';
import apiClient from '@/lib/api/client';
import {
  ArrowLeft,
  User,
  Phone,
  GraduationCap,
  Calendar,
  CreditCard,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  School
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
  class_days: number[];
  enrollment_date: string;
  monthly_tuition: number;
  discount_rate: number;
  memo: string | null;
  address: string | null;
}

interface PaymentSummary {
  current_month_status: string;
  unpaid_count: number;
  total_unpaid: number;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  rate: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: '재원', color: 'bg-green-100 text-green-700' },
  paused: { label: '휴원', color: 'bg-yellow-100 text-yellow-700' },
  withdrawn: { label: '퇴원', color: 'bg-red-100 text-red-700' },
  graduated: { label: '졸업', color: 'bg-blue-100 text-blue-700' },
  trial: { label: '체험', color: 'bg-purple-100 text-purple-700' },
  pending: { label: '대기', color: 'bg-gray-100 text-gray-700' },
};

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function TabletStudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orientation = useOrientation();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studentId) {
      fetchStudentData();
    }
  }, [studentId]);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      // Fetch student details
      const studentRes = await apiClient.get<{ student: Student }>(`/students/${studentId}`);
      setStudent(studentRes.student);

      // Fetch payment summary
      try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const paymentRes = await apiClient.get<{ payments: Array<{ payment_status: string; remaining_amount: number }> }>(
          '/payments',
          { params: { student_id: studentId, year_month: currentMonth } }
        );
        const payments = paymentRes.payments || [];
        const unpaid = payments.filter(p => p.payment_status !== 'paid');
        setPaymentSummary({
          current_month_status: payments[0]?.payment_status || 'none',
          unpaid_count: unpaid.length,
          total_unpaid: unpaid.reduce((sum, p) => sum + (p.remaining_amount || 0), 0)
        });
      } catch {
        // Payment fetch failed, skip
      }

      // Fetch attendance summary (this month)
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
          params: { start_date: startOfMonth, end_date: endOfMonth }
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
        // Attendance fetch failed, skip
      }
    } catch (error) {
      console.error('Failed to fetch student:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatClassDays = (days: number[]) => {
    if (!days || days.length === 0) return '-';
    return days.map(d => DAY_LABELS[d]).join(', ');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
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

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-600 mb-4"
        >
          <ArrowLeft size={20} />
          <span>목록으로</span>
        </button>

        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${
            student.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'
          }`}>
            {student.name.charAt(0)}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-800">{student.name}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                STATUS_LABELS[student.status]?.color || 'bg-gray-100 text-gray-700'
              }`}>
                {STATUS_LABELS[student.status]?.label || student.status}
              </span>
              {student.is_trial && (
                <span className="px-3 py-1 bg-purple-100 text-purple-600 text-sm rounded-full">
                  체험 {student.trial_remaining}회 남음
                </span>
              )}
            </div>
            <p className="text-slate-500">{student.grade} · {student.school || '-'}</p>
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className={`grid gap-4 ${orientation === 'landscape' ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {/* 출석 현황 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="text-green-500" size={20} />
            <h3 className="font-bold text-slate-800">이번달 출석</h3>
          </div>
          {attendanceSummary ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">출석률</span>
                <span className="font-bold text-green-600">{attendanceSummary.rate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">출석</span>
                <span className="text-slate-800">{attendanceSummary.present}회</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">결석</span>
                <span className="text-red-600">{attendanceSummary.absent}회</span>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">출석 정보 없음</p>
          )}
        </div>

        {/* 납부 현황 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="text-blue-500" size={20} />
            <h3 className="font-bold text-slate-800">납부 현황</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">월 수업료</span>
              <span className="text-slate-800">{formatCurrency(student.monthly_tuition || 0)}</span>
            </div>
            {student.discount_rate > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">할인율</span>
                <span className="text-blue-500">{student.discount_rate}%</span>
              </div>
            )}
            {paymentSummary && paymentSummary.total_unpaid > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">미납금</span>
                <span className="text-red-600">{formatCurrency(paymentSummary.total_unpaid)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 수업 정보 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="text-blue-500" size={20} />
            <h3 className="font-bold text-slate-800">수업 정보</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">수업 요일</span>
              <span className="text-slate-800">{formatClassDays(student.class_days)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">등록일</span>
              <span className="text-slate-800">
                {student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString('ko-KR') : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 연락처 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">연락처</h3>
        <div className="grid gap-4 grid-cols-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
              <Phone size={18} className="text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-400">학생</p>
              <p className="text-slate-800">{student.phone || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
              <Phone size={18} className="text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-400">학부모</p>
              <p className="text-slate-800">{student.parent_phone || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 메모 */}
      {student.memo && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-2">메모</h3>
          <p className="text-slate-600 whitespace-pre-wrap">{student.memo}</p>
        </div>
      )}
    </div>
  );
}

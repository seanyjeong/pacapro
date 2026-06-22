'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Edit, Trash2, UserMinus, GraduationCap, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudentAttendanceComponent } from '@/components/students/student-attendance';
import { StudentCard } from '@/components/students/student-card';
import { StudentConsultationsComponent } from '@/components/students/student-consultations';
import { StudentPaymentsComponent } from '@/components/students/student-payments';
import { StudentPerformanceComponent } from '@/components/students/student-performance';
import { StudentResumeModal } from '@/components/students/student-resume-modal';
import { StudentSeasonsComponent } from '@/components/students/student-seasons';
import { useStudent } from '@/hooks/use-students';
import { studentsAPI } from '@/lib/api/students';
import { STATUS_LABELS } from '@/lib/types/student';
import { StudentDetailError, StudentDetailLoading } from './student-detail-states';
import { StudentDetailSummary } from './student-detail-summary';
import { StudentDetailTabs } from './student-detail-tabs';
import type { StudentDetailTab } from './student-detail-types';
import { buildStudentTabs } from './student-detail-utils';

export function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = Number.parseInt(params.id as string, 10);
  const [activeTab, setActiveTab] = useState<StudentDetailTab>('performance');
  const [resumeModalOpen, setResumeModalOpen] = useState(false);

  const { error, loading, payments, performances, reload, student } = useStudent(studentId);
  const tabs = useMemo(() => (student ? buildStudentTabs(student, payments.length) : []), [payments.length, student]);

  const goBack = () => router.push('/students');

  const handleEdit = () => {
    router.push(`/students/${studentId}/edit`);
  };

  const handleDelete = async () => {
    if (!student) return;
    const confirmation = prompt(`"${student.name}" 학생을 삭제하려면 "삭제"를 입력해주세요.`);
    if (confirmation !== '삭제') {
      if (confirmation !== null) toast.error('입력값이 일치하지 않습니다.');
      return;
    }

    try {
      await studentsAPI.deleteStudent(studentId, { suppressErrorToast: true });
      toast.success(`${student.name} 학생이 삭제되었습니다.`);
      router.push('/students');
    } catch (err) {
      console.error('Failed to delete student:', err);
      toast.error('학생 삭제에 실패했습니다.');
    }
  };

  const handleGraduate = async () => {
    if (!student) return;
    const confirmation = prompt(`"${student.name}" 학생을 졸업 처리하려면 "졸업"을 입력해주세요.`);
    if (confirmation !== '졸업') {
      if (confirmation !== null) toast.error('입력값이 일치하지 않습니다.');
      return;
    }

    try {
      await studentsAPI.updateStudent(studentId, { status: 'graduated' }, { suppressErrorToast: true });
      toast.success(`${student.name} 학생이 졸업 처리되었습니다.`);
      reload();
    } catch (err) {
      console.error('Failed to graduate student:', err);
      toast.error('졸업 처리에 실패했습니다.');
    }
  };

  const handleWithdraw = async () => {
    if (!student) return;
    const unpaidPayments = payments.filter((payment) => payment.payment_status !== 'paid');
    const warning = unpaidPayments.length > 0
      ? `"${student.name}" 학생은 미납 학원비 ${unpaidPayments.length}건이 있습니다. 퇴원 처리하려면 "퇴원"을 입력해주세요.`
      : `"${student.name}" 학생을 퇴원 처리하려면 "퇴원"을 입력해주세요.`;
    const confirmation = prompt(warning);

    if (confirmation !== '퇴원') {
      if (confirmation !== null) toast.error('입력값이 일치하지 않습니다.');
      return;
    }

    const reason = prompt('퇴원 사유를 입력해주세요. 빈칸으로 둘 수 있습니다.');
    if (reason === null) return;

    try {
      await studentsAPI.withdrawStudent(studentId, reason || undefined, undefined, { suppressErrorToast: true });
      toast.success(`${student.name} 학생이 퇴원 처리되었습니다.`);
      reload();
    } catch (err) {
      console.error('Failed to withdraw student:', err);
      toast.error('퇴원 처리에 실패했습니다.');
    }
  };

  if (loading) return <StudentDetailLoading onBack={goBack} />;
  if (error || !student) return <StudentDetailError message={error} onBack={goBack} onRetry={reload} />;

  const canGraduate = (student.grade === '고3' || student.grade === 'N수') && student.status === 'active';
  const canWithdraw = student.status === 'active' || student.status === 'paused';
  const canResume = student.status === 'paused';

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <Button className="mb-2" size="sm" type="button" variant="outline" onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Button>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Student Profile</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">학생 상세</h1>
          <p className="text-sm text-muted-foreground">
            {student.name} 학생의 정보, 출결, 납부, 시즌, 상담 기록을 확인합니다.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button className="justify-center" type="button" variant="outline" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            수정
          </Button>
          {canGraduate ? (
            <Button className="justify-center" type="button" variant="outline" onClick={handleGraduate}>
              <GraduationCap className="mr-2 h-4 w-4" />
              졸업 처리
            </Button>
          ) : null}
          {canWithdraw ? (
            <Button className="justify-center" type="button" variant="outline" onClick={handleWithdraw}>
              <UserMinus className="mr-2 h-4 w-4" />
              퇴원 처리
            </Button>
          ) : null}
          {canResume ? (
            <Button className="justify-center" type="button" variant="outline" onClick={() => setResumeModalOpen(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              복귀 처리
            </Button>
          ) : null}
          <Button className="justify-center text-rose-700 hover:text-rose-800" type="button" variant="outline" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            삭제
          </Button>
        </div>
      </header>

      <StudentDetailSummary payments={payments} student={student} />

      <StudentCard student={student} />

      <section className="rounded-md border border-border bg-card">
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">운영 기록</p>
            <p className="text-xs text-muted-foreground">현재 상태: {STATUS_LABELS[student.status]}</p>
          </div>
        </div>
        <StudentDetailTabs activeTab={activeTab} tabs={tabs} onTabChange={setActiveTab} />
        <div className="p-4">
          {activeTab === 'performance' ? <StudentPerformanceComponent loading={false} performances={performances} /> : null}
          {activeTab === 'attendance' ? <StudentAttendanceComponent studentId={studentId} /> : null}
          {activeTab === 'payments' ? (
            <StudentPaymentsComponent
              classDays={student.class_days}
              loading={false}
              monthlyTuition={Number.parseFloat(student.monthly_tuition) || 0}
              payments={payments}
              studentId={studentId}
              studentName={student.name}
              weeklyCount={student.weekly_count || 2}
            />
          ) : null}
          {activeTab === 'seasons' ? <StudentSeasonsComponent studentId={studentId} studentType={student.student_type} /> : null}
          {activeTab === 'consultations' ? <StudentConsultationsComponent studentId={studentId} studentName={student.name} /> : null}
        </div>
      </section>

      {student.status === 'paused' ? (
        <StudentResumeModal
          open={resumeModalOpen}
          student={{
            class_days: student.class_days,
            discount_rate: student.discount_rate,
            grade: student.grade,
            id: student.id,
            monthly_tuition: student.monthly_tuition,
            name: student.name,
            phone: student.phone,
            rest_end_date: student.rest_end_date,
            rest_reason: student.rest_reason,
            rest_start_date: student.rest_start_date || '',
            school: student.school,
            time_slot: student.time_slot,
            weekly_count: student.weekly_count,
          }}
          onClose={() => setResumeModalOpen(false)}
          onSuccess={() => {
            setResumeModalOpen(false);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

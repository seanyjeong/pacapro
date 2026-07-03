'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { StudentAttendanceComponent } from '@/components/students/student-attendance';
import { StudentCard } from '@/components/students/student-card';
import { StudentConsultationsComponent } from '@/components/students/student-consultations';
import { StudentPhotoField } from '@/components/students/student-form/_components/StudentPhotoField';
import { StudentPaymentsComponent } from '@/components/students/student-payments';
import { StudentPerformanceComponent } from '@/components/students/student-performance';
import { StudentResumeModal } from '@/components/students/student-resume-modal';
import { StudentSeasonsComponent } from '@/components/students/student-seasons';
import { useStudent } from '@/hooks/use-students';
import { studentsAPI } from '@/lib/api/students';
import { STATUS_LABELS } from '@/lib/types/student';
import { StudentDetailActionDialog } from './student-detail-action-dialog';
import { StudentDetailActions } from './student-detail-actions';
import { StudentDetailError, StudentDetailLoading } from './student-detail-states';
import { StudentDetailHeader } from './student-detail-header';
import { StudentDetailSummary } from './student-detail-summary';
import { StudentDetailTabs } from './student-detail-tabs';
import type { StudentDetailAction, StudentDetailTab } from './student-detail-types';
import { buildStudentTabs, getOutstandingAmount } from './student-detail-utils';

export function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = Number.parseInt(params.id as string, 10);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<StudentDetailTab | null>(null);
  const [pendingAction, setPendingAction] = useState<StudentDetailAction | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);

  const { error, loading, payments, performances, reload, student } = useStudent(studentId);
  const tabs = useMemo(() => (student ? buildStudentTabs(student, payments.length) : []), [payments.length, student]);
  const outstandingAmount = getOutstandingAmount(payments);
  const unpaidPaymentCount = payments.filter((payment) => payment.payment_status !== 'paid').length;
  const resolvedActiveTab = activeTab ?? (unpaidPaymentCount > 0 ? 'payments' : 'performance');

  const goBack = () => router.push('/students');

  const handleEdit = () => {
    router.push(`/students/${studentId}/edit`);
  };

  const handleOpenClassDays = () => {
    router.push(`/students/class-days?studentId=${studentId}`);
  };

  const handleSendSms = () => {
    router.push(`/sms?studentId=${studentId}&recipient=parent`);
  };

  const handlePhotoChanged = () => {
    setPendingPhotoFile(null);
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['students', studentId] });
    reload();
  };

  const handleDelete = async () => {
    if (!student) return;
    await studentsAPI.deleteStudent(studentId, { suppressErrorToast: true });
    toast.success(`${student.name} 학생이 삭제되었습니다.`);
    router.push('/students');
  };

  const handleGraduate = async () => {
    if (!student) return;
    await studentsAPI.updateStudent(studentId, { status: 'graduated' }, { suppressErrorToast: true });
    toast.success(`${student.name} 학생이 졸업 처리되었습니다.`);
    reload();
  };

  const handleWithdraw = async (reason?: string) => {
    if (!student) return;
    await studentsAPI.withdrawStudent(studentId, reason, undefined, { suppressErrorToast: true });
    toast.success(`${student.name} 학생이 퇴원 처리되었습니다.`);
    reload();
  };

  const handleConfirmAction = async (action: StudentDetailAction, data: { reason?: string }) => {
    setActionBusy(true);
    try {
      if (action === 'delete') await handleDelete();
      if (action === 'graduate') await handleGraduate();
      if (action === 'withdraw') await handleWithdraw(data.reason);
      setPendingAction(null);
    } catch (err) {
      console.warn('학생 상태 변경에 실패했습니다.', err);
      toast.error('학생 상태를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) return <StudentDetailLoading onBack={goBack} />;
  if (error || !student) return <StudentDetailError message={error} onBack={goBack} onRetry={reload} />;

  const canGraduate = (student.grade === '고3' || student.grade === 'N수') && student.status === 'active';
  const canWithdraw = student.status === 'active' || student.status === 'paused';
  const canResume = student.status === 'paused';

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5" data-testid="student-detail-workspace">
      <StudentDetailHeader
        description={`${student.name} 학생의 정보, 출결, 납부, 시즌, 상담 기록을 확인합니다.`}
        onBack={goBack}
      />

      <StudentDetailSummary payments={payments} student={student} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <main className="order-2 min-w-0 space-y-5 xl:order-1">
          <StudentCard student={student} />

          <section className="rounded-md border border-border bg-card">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">운영 기록</p>
                <p className="text-xs text-muted-foreground">현재 상태: {STATUS_LABELS[student.status]}</p>
              </div>
            </div>
            <StudentDetailTabs activeTab={resolvedActiveTab} tabs={tabs} onTabChange={setActiveTab} />
            <div className="p-4">
              {resolvedActiveTab === 'performance' ? <StudentPerformanceComponent loading={false} performances={performances} /> : null}
              {resolvedActiveTab === 'attendance' ? <StudentAttendanceComponent studentId={studentId} /> : null}
              {resolvedActiveTab === 'payments' ? (
                <StudentPaymentsComponent
                  classDays={student.class_days}
                  loading={false}
                  monthlyTuition={Number.parseFloat(student.monthly_tuition) || 0}
                  payments={payments}
                  studentId={studentId}
                  studentName={student.name}
                  weeklyCount={student.weekly_count || 2}
                  onChanged={reload}
                />
              ) : null}
              {resolvedActiveTab === 'seasons' ? <StudentSeasonsComponent studentId={studentId} studentType={student.student_type} /> : null}
              {resolvedActiveTab === 'consultations' ? <StudentConsultationsComponent studentId={studentId} studentName={student.name} /> : null}
            </div>
          </section>
        </main>

        <div className="order-1 space-y-5 xl:sticky xl:top-20 xl:order-2">
          <StudentPhotoField
            mode="edit"
            pendingPhotoFile={pendingPhotoFile}
            student={student}
            onPendingPhotoFileChange={setPendingPhotoFile}
            onPhotoChanged={handlePhotoChanged}
          />

          <StudentDetailActions
            canGraduate={canGraduate}
            canResume={canResume}
            canWithdraw={canWithdraw}
            outstandingAmount={outstandingAmount}
            paymentCount={payments.length}
            student={student}
            unpaidPaymentCount={unpaidPaymentCount}
            onEdit={handleEdit}
            onOpenClassDays={handleOpenClassDays}
            onOpenAction={setPendingAction}
            onOpenTab={setActiveTab}
            onResume={() => setResumeModalOpen(true)}
            onSendSms={handleSendSms}
          />
        </div>
      </div>

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

      <StudentDetailActionDialog
        action={pendingAction}
        busy={actionBusy}
        open={pendingAction !== null}
        studentName={student.name}
        unpaidPaymentCount={unpaidPaymentCount}
        onConfirm={handleConfirmAction}
        onOpenChange={(open) => {
          if (!open && !actionBusy) setPendingAction(null);
        }}
      />
    </div>
  );
}

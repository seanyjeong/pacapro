'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SectionCard } from '@/components/ui/page';
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
import type { WithdrawalBillingResult } from '@/lib/types/lifecycle-billing';
import { describeWithdrawalBillingResult, getLifecycleErrorMessage } from '@/lib/utils/lifecycle-billing';
import { LifecycleBillingResultPanel } from '@/components/students/lifecycle-billing-preview';
import { getStudentListReturnUrl } from '@/features/students/student-list-return';
import { StudentDetailActionDialog } from './student-detail-action-dialog';
import { StudentDetailActions } from './student-detail-actions';
import { StudentDetailError, StudentDetailLoading } from './student-detail-states';
import { StudentDetailBack } from './student-detail-header';
import { StudentDetailHero } from './student-detail-hero';
import { StudentDetailSummary } from './student-detail-summary';
import { StudentPlacementPanel } from '@/features/branches/student-placement-panel';
import { StudentDetailTabs } from './student-detail-tabs';
import type { StudentDetailAction, StudentDetailTab } from './student-detail-types';
import { buildStudentTabs } from './student-detail-utils';

export function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = Number.parseInt(params.id as string, 10);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<StudentDetailTab | null>(null);
  const [pendingAction, setPendingAction] = useState<StudentDetailAction | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [billingResult, setBillingResult] = useState<WithdrawalBillingResult | null>(null);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);

  const { error, loading, payments, performances, reload, student } = useStudent(studentId);
  const tabs = useMemo(() => (student ? buildStudentTabs(student, payments.length) : []), [payments.length, student]);
  const unpaidPaymentCount = payments.filter((payment) => !['paid', 'cancelled'].includes(payment.payment_status)).length;
  const resolvedActiveTab = activeTab ?? (unpaidPaymentCount > 0 ? 'payments' : 'performance');

  const goBack = () => router.push(getStudentListReturnUrl(studentId));

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

  const handleWithdraw = async (reason?: string, date?: string, previewHash?: string) => {
    if (!student) return;
    const response = await studentsAPI.withdrawStudent(studentId, reason, date, { suppressErrorToast: true }, previewHash);
    setBillingResult(response.billing);
    await queryClient.invalidateQueries({ queryKey: ['payments'] });
    await queryClient.invalidateQueries({ queryKey: ['students'] });
    toast.success(`${student.name} 학생이 퇴원 처리되었습니다.`, { description: describeWithdrawalBillingResult(response.billing) });
    reload();
  };

  const handleConfirmAction = async (action: StudentDetailAction, data: { reason?: string; date?: string; previewHash?: string }) => {
    setActionBusy(true);
    try {
      if (action === 'delete') await handleDelete();
      if (action === 'graduate') await handleGraduate();
      if (action === 'withdraw') await handleWithdraw(data.reason, data.date, data.previewHash);
      setPendingAction(null);
    } catch (err) {
      console.warn('학생 상태 변경에 실패했습니다.', err);
      toast.error(getLifecycleErrorMessage(err, '학생 상태를 변경하지 못했습니다. 변경 내역을 확인해주세요.'));
      throw err;
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
    <div className="mx-auto w-full max-w-7xl space-y-4" data-testid="student-detail-workspace">
      <StudentDetailBack onBack={goBack} />

      <StudentDetailHero
        student={student}
        actions={(
          <StudentDetailActions
            canGraduate={canGraduate}
            canResume={canResume}
            canWithdraw={canWithdraw}
            unpaidPaymentCount={unpaidPaymentCount}
            onEdit={handleEdit}
            onOpenClassDays={handleOpenClassDays}
            onOpenAction={setPendingAction}
            onResume={() => setResumeModalOpen(true)}
            onSendSms={handleSendSms}
          />
        )}
      />

      <StudentDetailSummary
        payments={payments}
        student={student}
        unpaidPaymentCount={unpaidPaymentCount}
        onOpenPayments={() => setActiveTab('payments')}
      />
      {billingResult ? <LifecycleBillingResultPanel title="퇴원 학원비 처리 결과" result={billingResult} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <SectionCard className="order-2 min-w-0 xl:order-1" title="운영 기록" bodyClassName="space-y-4">
          <StudentDetailTabs activeTab={resolvedActiveTab} tabs={tabs} onTabChange={setActiveTab} />
          <div className="min-w-0">
            {resolvedActiveTab === 'performance' ? <StudentPerformanceComponent loading={false} performances={performances} /> : null}
            {resolvedActiveTab === 'attendance' ? <StudentAttendanceComponent studentId={studentId} /> : null}
            {resolvedActiveTab === 'payments' ? (
              <StudentPaymentsComponent
                classDays={student.class_days}
                loading={false}
                monthlyTuition={Number.parseFloat(student.monthly_tuition) || 0}
                discountRate={Number.parseFloat(student.discount_rate) || 0}
                payments={payments}
                studentId={studentId}
                studentName={student.name}
                weeklyCount={student.weekly_count || 2}
                onChanged={reload}
              />
            ) : null}
            {resolvedActiveTab === 'seasons' ? <StudentSeasonsComponent studentId={studentId} studentType={student.student_type} branchId={student.branch_id ?? null} /> : null}
            {resolvedActiveTab === 'consultations' ? <StudentConsultationsComponent studentId={studentId} studentName={student.name} /> : null}
          </div>
        </SectionCard>

        <div className="order-1 min-w-0 space-y-4 xl:sticky xl:top-20 xl:order-2">
          <StudentPlacementPanel
            studentId={student.id}
            value={{ branch_id: student.branch_id ?? null, class_id: student.class_id ?? null }}
            onChange={() => reload()}
          />
          <StudentCard student={student} />
          <StudentPhotoField
            mode="edit"
            pendingPhotoFile={pendingPhotoFile}
            student={student}
            onPendingPhotoFileChange={setPendingPhotoFile}
            onPhotoChanged={handlePhotoChanged}
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
        studentId={student.id}
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

'use client';

import { useParams, useRouter } from 'next/navigation';
import { PasswordConfirmModal } from '@/components/modals/password-confirm-modal';
import { SalaryAttendanceSection } from './salary-attendance-section';
import { SalaryBasicInfo } from './salary-basic-info';
import { SalaryCalculationSection } from './salary-calculation-section';
import { SalaryDetailError } from './salary-detail-error';
import { SalaryDetailFooter } from './salary-detail-footer';
import { SalaryDetailHeader } from './salary-detail-header';
import { SalaryDetailLoading } from './salary-detail-loading';
import { SalaryPaidInfo } from './salary-paid-info';
import { SalaryPrintStyles } from './salary-print-styles';
import { SalaryRateInfo } from './salary-rate-info';
import { SalaryRecalculateDialog } from './salary-recalculate-dialog';
import { useSalaryDetailState } from './use-salary-detail-state';
import { formatCurrency } from './salary-detail-utils';

export function SalaryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const salaryId = Number(params.id);
  const state = useSalaryDetailState(salaryId);

  if (state.loading) return <SalaryDetailLoading onBack={() => router.back()} />;
  if (state.error || !state.salary) {
    return <SalaryDetailError message={state.error || '급여 정보를 찾을 수 없습니다.'} onBack={() => router.back()} onRetry={state.reload} />;
  }

  return (
    <>
      <SalaryPrintStyles />
      <div className="mx-auto max-w-4xl space-y-4 print-container">
        <SalaryDetailHeader
          salary={state.salary}
          paying={state.paying}
          recalculating={state.recalculating}
          onBack={() => router.back()}
          onPrint={() => window.print()}
          onPay={state.requestPayment}
          onRecalculate={state.requestRecalculate}
        />
        <SalaryBasicInfo salary={state.salary} attendanceSummary={state.attendanceSummary} />
        <SalaryRateInfo salary={state.salary} />
        <SalaryAttendanceSection attendanceSummary={state.attendanceSummary} />
        <SalaryCalculationSection
          salary={state.salary}
          attendanceSummary={state.attendanceSummary}
          editingIncentive={state.editingIncentive}
          incentiveInput={state.incentiveInput}
          savingIncentive={state.savingIncentive}
          onIncentiveChange={state.setIncentiveInput}
          onStartEdit={state.startEditIncentive}
          onCancelEdit={state.cancelEditIncentive}
          onSave={state.saveIncentive}
        />
        <SalaryPaidInfo salary={state.salary} />
        <SalaryDetailFooter
          salary={state.salary}
          paying={state.paying}
          recalculating={state.recalculating}
          onBack={() => router.back()}
          onPay={state.requestPayment}
          onRecalculate={state.requestRecalculate}
        />
      </div>
      <SalaryRecalculateDialog
        busy={state.recalculating}
        open={state.showRecalculateDialog}
        onCancel={() => state.setShowRecalculateDialog(false)}
        onConfirm={state.executeRecalculate}
      />
      <PasswordConfirmModal
        open={state.showPasswordModal}
        onClose={() => state.setShowPasswordModal(false)}
        onConfirm={state.executePayment}
        title="급여 지급 확인"
        description={`${state.salary.instructor_name}님의 급여를 지급 처리합니다. (${formatCurrency(state.salary.net_salary)})\n비밀번호를 입력해주세요.`}
      />
    </>
  );
}

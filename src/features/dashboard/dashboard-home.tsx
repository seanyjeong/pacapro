import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { StudentResumeModal, type RestEndedStudent } from '@/components/students/student-resume-modal';
import { PasswordConfirmModal } from '@/components/modals/password-confirm-modal';
import { BranchChecks } from '@/features/branches/branch-checks';
import { useBranchTree } from '@/hooks/use-branches';
import { useDashboardData } from './use-dashboard-data';
import { DashboardErrorState } from './dashboard-error-state';
import { DashboardKpiStrip } from './dashboard-kpi-strip';
import { DashboardMonthSummary } from './dashboard-month-summary';
import { DashboardPrivacyControl } from './dashboard-privacy-control';
import { DashboardRestEndedDialog } from './dashboard-rest-ended-dialog';
import { DashboardWorkQueue } from './dashboard-work-queue';
import { useDashboardAmountPrivacy } from './use-dashboard-amount-privacy';

export function DashboardHome() {
    const router = useRouter();
    const dashboard = useDashboardData();
    const { branches } = useBranchTree();
    const amountPrivacy = useDashboardAmountPrivacy();
    const [showRestEndedDialog, setShowRestEndedDialog] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<RestEndedStudent | null>(null);

    if (dashboard.loading) {
        return <DashboardSkeleton />;
    }

    if (dashboard.error) {
        return <DashboardErrorState message={dashboard.error} onRetry={dashboard.refresh} />;
    }

    if (!dashboard.stats) return null;

    const hasSensitiveAmounts = dashboard.permissions.finance || dashboard.permissions.unpaid;

    const handleSelectRestEndedStudent = (student: RestEndedStudent) => {
        setSelectedStudent(student);
        setShowRestEndedDialog(false);
    };

    return (
        <div className="space-y-4">
            <PageHeader
                title="오늘"
                description={`${dashboard.todayLabel} · ${dashboard.stats.current_month.month} 기준`}
                actions={(
                    <>
                        {hasSensitiveAmounts && (
                            <DashboardPrivacyControl
                                amountsVisible={amountPrivacy.amountsVisible}
                                onReveal={amountPrivacy.requestReveal}
                                onHide={amountPrivacy.hideAmounts}
                            />
                        )}
                        <Button variant="outline" size="icon" onClick={dashboard.refresh} title="새로고침" aria-label="새로고침">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </>
                )}
            />

            <BranchChecks branches={branches} selected={dashboard.branchIds} onChange={dashboard.setBranchIds} />
            {dashboard.branchIds.length > 0 && (
                <p className="rounded-2xl bg-warning-soft px-4 py-3 text-[13px] font-medium text-warning" role="note">
                    학생 수와 학원비 매출·미납만 고른 지점 기준이에요. 기타 수입·지출·강사는 학원 전체 금액이에요.
                </p>
            )}

            <DashboardKpiStrip
                stats={dashboard.stats}
                permissions={dashboard.permissions}
                amountsVisible={amountPrivacy.amountsVisible}
            />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <DashboardWorkQueue
                    stats={dashboard.stats}
                    permissions={dashboard.permissions}
                    instructorsBySlot={dashboard.instructorsBySlot}
                    todayConsultations={dashboard.todayConsultations}
                    todayDataError={dashboard.todayDataError}
                    amountsVisible={amountPrivacy.amountsVisible}
                    onNavigate={router.push}
                    onOpenRestEnded={() => setShowRestEndedDialog(true)}
                    onRefresh={dashboard.refresh}
                />
                <DashboardMonthSummary
                    stats={dashboard.stats}
                    permissions={dashboard.permissions}
                    amountsVisible={amountPrivacy.amountsVisible}
                />
            </div>

            <DashboardRestEndedDialog
                open={showRestEndedDialog}
                students={dashboard.restEndedStudents}
                onOpenChange={setShowRestEndedDialog}
                onSelectStudent={handleSelectRestEndedStudent}
            />

            <StudentResumeModal
                open={!!selectedStudent}
                onClose={() => setSelectedStudent(null)}
                student={selectedStudent}
                onSuccess={dashboard.refresh}
            />

            <PasswordConfirmModal
                open={amountPrivacy.confirmOpen}
                onClose={amountPrivacy.cancelReveal}
                onConfirm={amountPrivacy.confirmReveal}
                title="금액 보기 확인"
                description="대시보드 금액을 잠시 표시하려면 로그인 비밀번호를 입력하세요."
            />
        </div>
    );
}

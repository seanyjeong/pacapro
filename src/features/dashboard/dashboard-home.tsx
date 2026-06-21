import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { StudentResumeModal, type RestEndedStudent } from '@/components/students/student-resume-modal';
import { PasswordConfirmModal } from '@/components/modals/password-confirm-modal';
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
        <div className="space-y-5">
            <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">PACA Operations Desk</div>
                    <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">오늘의 운영 현황</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {dashboard.todayLabel} · {dashboard.stats.current_month.month} 기준
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                        실제 운영 자료 연결
                    </span>
                    {hasSensitiveAmounts && (
                        <DashboardPrivacyControl
                            amountsVisible={amountPrivacy.amountsVisible}
                            onReveal={amountPrivacy.requestReveal}
                            onHide={amountPrivacy.hideAmounts}
                        />
                    )}
                    <Button variant="outline" className="gap-2" onClick={dashboard.refresh}>
                        <RefreshCw className="h-4 w-4" />
                        새로고침
                    </Button>
                </div>
            </header>

            <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
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

                <main className="min-w-0 space-y-5">
                    <DashboardKpiStrip
                        stats={dashboard.stats}
                        permissions={dashboard.permissions}
                        amountsVisible={amountPrivacy.amountsVisible}
                    />
                    <DashboardMonthSummary
                        stats={dashboard.stats}
                        permissions={dashboard.permissions}
                        amountsVisible={amountPrivacy.amountsVisible}
                    />
                </main>
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

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCog, TrendingUp, AlertCircle, Banknote, ChevronRight, ArrowUpRight, ArrowDownRight, Clock, Calendar, PlayCircle } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { dashboardAPI } from '@/lib/api/dashboard';
import { schedulesApi } from '@/lib/api/schedules';
import { getConsultations } from '@/lib/api/consultations';
import { studentsAPI } from '@/lib/api/students';
import { DashboardStats } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/format';
import { canView, canEdit, isOwner, isAdmin } from '@/lib/utils/permissions';
import type { Consultation } from '@/lib/types/consultation';
import { StudentResumeModal, type RestEndedStudent } from '@/components/students/student-resume-modal';

export default function DashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 오늘 강사 일정
    const [instructorsBySlot, setInstructorsBySlot] = useState<{
        morning: { id: number; name: string }[];
        afternoon: { id: number; name: string }[];
        evening: { id: number; name: string }[];
    }>({ morning: [], afternoon: [], evening: [] });

    // 오늘 상담 일정
    const [todayConsultations, setTodayConsultations] = useState<Consultation[]>([]);

    // 휴원 종료 대기 학생
    const [restEndedStudents, setRestEndedStudents] = useState<RestEndedStudent[]>([]);
    const [showRestEndedModal, setShowRestEndedModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<RestEndedStudent | null>(null);

    // 권한 체크 - 클라이언트에서만 실행 (hydration 에러 방지)
    const [canViewFinance, setCanViewFinance] = useState(false);
    const [canViewUnpaid, setCanViewUnpaid] = useState(false);
    const [canViewSchedules, setCanViewSchedules] = useState(false);
    const [canViewConsultations, setCanViewConsultations] = useState(false);

    useEffect(() => {
        // 모바일 기기 감지 → /m 으로 리다이렉트
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            router.replace('/m');
            return;
        }

        setCanViewFinance(isOwner() || isAdmin() || canView('dashboard_finance'));
        setCanViewUnpaid(isOwner() || isAdmin() || canView('dashboard_unpaid'));
        setCanViewSchedules(isOwner() || isAdmin() || canEdit('schedules'));
        setCanViewConsultations(isOwner() || isAdmin() || canView('consultations'));
        loadDashboard();
        loadTodayData();
    }, [router]);

    const loadTodayData = async () => {
        const today = new Date().toISOString().split('T')[0];

        // 오늘 강사 일정 로드
        try {
            const instructorData = await schedulesApi.getInstructorAttendanceByDate(today);
            if (instructorData.instructors_by_slot) {
                setInstructorsBySlot(instructorData.instructors_by_slot);
            } else if (instructorData.instructors) {
                // 시간대별 분류가 없으면 전체를 모든 시간대에 표시
                setInstructorsBySlot({
                    morning: instructorData.instructors,
                    afternoon: instructorData.instructors,
                    evening: instructorData.instructors,
                });
            }
        } catch (err) {
            console.error('Failed to load instructor schedules:', err);
        }

        // 오늘 상담 일정 로드
        try {
            const consultationData = await getConsultations({
                startDate: today,
                endDate: today,
                status: 'confirmed',
            });
            setTodayConsultations(consultationData.consultations || []);
        } catch (err) {
            console.error('Failed to load consultations:', err);
        }

        // 휴원 종료 대기 학생 로드
        try {
            const restEndedData = await studentsAPI.getRestEndedStudents();
            setRestEndedStudents(restEndedData.students || []);
        } catch (err) {
            console.error('Failed to load rest-ended students:', err);
        }
    };

    const loadDashboard = async () => {
        try {
            setLoading(true);
            const data = await dashboardAPI.getStats();
            setStats(data);
            setError(null);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
            // 401 에러는 로그인 페이지로 리다이렉트되므로 에러 메시지 표시 안 함
            if (axiosErr.response?.status === 401) {
                return;
            }
            setError(axiosErr.response?.data?.message || '대시보드 데이터를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground">로딩 중...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full">
                <Card className="max-w-md">
                    <CardContent className="p-6 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">데이터 로드 실패</h3>
                        <p className="text-muted-foreground mb-4">{error}</p>
                        <Button onClick={loadDashboard}>다시 시도</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!stats) return null;

    const netIncome = stats.current_month.net_income;
    const isProfit = netIncome >= 0;

    // 날짜 포맷
    const today = new Date();
    const dateStr = today.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const weekdayStr = today.toLocaleDateString('ko-KR', { weekday: 'long' });

    return (
        <div className="space-y-8">
            {/* Header - 개선된 타이포그래피 */}
            <div className="space-y-1">
                <div className="flex items-baseline gap-3">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        대시보드
                    </h1>
                    <span className="text-sm font-medium text-muted-foreground">
                        {stats.current_month.month}
                    </span>
                </div>
                <p className="text-muted-foreground">
                    {dateStr} <span className="text-primary font-medium">{weekdayStr}</span>
                </p>
            </div>

            {/* Stats Grid - 스태거 애니메이션 적용 */}
            <div className={`grid grid-cols-1 md:grid-cols-2 ${canViewFinance ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-5 stagger-children`}>
                {/* 학생 현황 */}
                <StatsCard
                    title="수강 학생"
                    value={`${stats.students.active_students ?? 0}명`}
                    icon={Users}
                    accentColor="blue"
                />

                {/* 강사 현황 */}
                <StatsCard
                    title="근무 강사"
                    value={`${stats.instructors.active_instructors ?? 0}명`}
                    icon={UserCog}
                    accentColor="violet"
                />

                {/* 이번 달 수입 - 권한 체크 */}
                {canViewFinance && (
                    <StatsCard
                        title="이번 달 수입"
                        value={formatCurrency(stats.current_month.revenue.amount)}
                        icon={TrendingUp}
                        accentColor="emerald"
                        trend={{
                            value: `${stats.current_month.revenue.count}건`,
                            isPositive: true
                        }}
                    />
                )}

                {/* 순수익 - 권한 체크 */}
                {canViewFinance && (
                    <StatsCard
                        title="순수익"
                        value={formatCurrency(netIncome)}
                        icon={Banknote}
                        accentColor={isProfit ? 'cyan' : 'amber'}
                        trend={{
                            value: isProfit ? '흑자' : '적자',
                            isPositive: isProfit
                        }}
                    />
                )}
            </div>

            {/* Action Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 오늘의 할 일 */}
                <Card className="overflow-hidden">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold">오늘의 할 일</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* 미납 학원비 - 권한 체크 */}
                        {canViewUnpaid && stats.unpaid_payments.count > 0 && (
                            <button
                                onClick={() => router.push('/payments?status=unpaid')}
                                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 rounded-xl border border-red-200/60 dark:border-red-800/40 hover:border-red-300 dark:hover:border-red-700 transition-all duration-200 group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
                                        <AlertCircle className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold text-foreground">미납 학원비</div>
                                        <div className="text-sm text-muted-foreground">
                                            {stats.unpaid_payments.count}건 · {formatCurrency(stats.unpaid_payments.amount)}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                            </button>
                        )}

                        {/* 휴원 종료 대기 */}
                        {stats.rest_ended_students && stats.rest_ended_students.count > 0 && (
                            <button
                                onClick={() => setShowRestEndedModal(true)}
                                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50 rounded-xl border border-amber-200/60 dark:border-amber-800/40 hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-200 group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                                        <PlayCircle className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold text-foreground">휴원 종료 대기</div>
                                        <div className="text-sm text-muted-foreground">
                                            {stats.rest_ended_students.count}명 복귀 처리 필요
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                            </button>
                        )}

                        {/* 오늘 강사 일정 */}
                        {canViewSchedules && (instructorsBySlot.morning.length > 0 || instructorsBySlot.afternoon.length > 0 || instructorsBySlot.evening.length > 0) && (
                            <button
                                onClick={() => router.push('/schedules')}
                                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 rounded-xl border border-violet-200/60 dark:border-violet-800/40 hover:border-violet-300 dark:hover:border-violet-700 transition-all duration-200 group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                                        <Clock className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold text-foreground">오늘 강사 일정</div>
                                        <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
                                            {instructorsBySlot.morning.length > 0 && (
                                                <span>오전 {instructorsBySlot.morning.map(i => i.name).join(', ')}</span>
                                            )}
                                            {instructorsBySlot.afternoon.length > 0 && (
                                                <span>오후 {instructorsBySlot.afternoon.map(i => i.name).join(', ')}</span>
                                            )}
                                            {instructorsBySlot.evening.length > 0 && (
                                                <span>저녁 {instructorsBySlot.evening.map(i => i.name).join(', ')}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                            </button>
                        )}

                        {/* 오늘 상담 일정 */}
                        {canViewConsultations && todayConsultations.length > 0 && (
                            <button
                                onClick={() => router.push('/consultations')}
                                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-950/50 dark:to-teal-950/50 rounded-xl border border-cyan-200/60 dark:border-cyan-800/40 hover:border-cyan-300 dark:hover:border-cyan-700 transition-all duration-200 group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                                        <Calendar className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold text-foreground">오늘 상담 일정</div>
                                        <div className="text-sm text-muted-foreground">
                                            {todayConsultations.length}건 · {todayConsultations.map(c => `${c.preferred_time} ${c.student_name}`).join(', ')}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                            </button>
                        )}
                    </CardContent>
                </Card>

                {/* 최근 활동 - 타임라인 스타일 */}
                <Card className="overflow-hidden">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold">이번 달 현황</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {canViewFinance ? (
                                <>
                                    {/* 수입 */}
                                    <div className="flex items-center gap-4 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                                            <ArrowUpRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-foreground">
                                                수입
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {stats.current_month.revenue.count}건 납부
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(stats.current_month.revenue.amount)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 지출 */}
                                    <div className="flex items-center gap-4 p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20">
                                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                                            <ArrowDownRight className="w-5 h-5 text-red-600 dark:text-red-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-foreground">
                                                지출
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {stats.current_month.expenses.count}건 지출
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-red-600 dark:text-red-400">
                                                {formatCurrency(stats.current_month.expenses.amount)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 순수익 */}
                                    <div className={`flex items-center gap-4 p-3 rounded-lg ${isProfit ? 'bg-cyan-50/50 dark:bg-cyan-950/20' : 'bg-amber-50/50 dark:bg-amber-950/20'}`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isProfit ? 'bg-cyan-100 dark:bg-cyan-900/50' : 'bg-amber-100 dark:bg-amber-900/50'}`}>
                                            <Banknote className={`w-5 h-5 ${isProfit ? 'text-cyan-600 dark:text-cyan-400' : 'text-amber-600 dark:text-amber-400'}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-foreground">
                                                순수익
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {stats.current_month.month}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-bold ${isProfit ? 'text-cyan-600 dark:text-cyan-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                {formatCurrency(netIncome)}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Users className="w-8 h-8 text-primary" />
                                    </div>
                                    <p className="font-medium text-foreground">학생 {stats.students.active_students ?? 0}명 관리 중</p>
                                    <p className="text-sm text-muted-foreground mt-1">강사 {stats.instructors.active_instructors ?? 0}명 근무 중</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 휴원 종료 대기 학생 목록 모달 */}
            <Dialog open={showRestEndedModal} onOpenChange={setShowRestEndedModal}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>휴원 종료 대기 학생</DialogTitle>
                        <DialogDescription>
                            복귀할 학생을 선택해주세요.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 px-6 max-h-96 overflow-y-auto space-y-2">
                        {restEndedStudents.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">
                                휴원 종료 대기 중인 학생이 없습니다.
                            </div>
                        ) : (
                            restEndedStudents.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => {
                                        setSelectedStudent(student);
                                        setShowRestEndedModal(false);
                                    }}
                                    className="w-full p-3 text-left rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="font-medium">{student.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {student.grade} · 종료일: {student.rest_end_date} ({student.days_overdue}일 경과)
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* 복귀 처리 모달 */}
            <StudentResumeModal
                open={!!selectedStudent}
                onClose={() => setSelectedStudent(null)}
                student={selectedStudent}
                onSuccess={() => {
                    loadDashboard();
                    loadTodayData();
                }}
            />
        </div>
    );
}

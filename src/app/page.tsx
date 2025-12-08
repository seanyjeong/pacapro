'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCog, TrendingUp, TrendingDown, AlertCircle, Banknote } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { dashboardAPI } from '@/lib/api/dashboard';
import { DashboardStats } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/format';
import { canView, isOwner, isAdmin } from '@/lib/utils/permissions';

export default function DashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 권한 체크 - 클라이언트에서만 실행 (hydration 에러 방지)
    const [canViewFinance, setCanViewFinance] = useState(false);
    const [canViewUnpaid, setCanViewUnpaid] = useState(false);

    useEffect(() => {
        // 모바일 기기 감지 → /m 으로 리다이렉트
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            router.replace('/m');
            return;
        }

        setCanViewFinance(isOwner() || isAdmin() || canView('dashboard_finance'));
        setCanViewUnpaid(isOwner() || isAdmin() || canView('dashboard_unpaid'));
        loadDashboard();
    }, [router]);

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
                    <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">로딩 중...</p>
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
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">데이터 로드 실패</h3>
                        <p className="text-gray-600 mb-4">{error}</p>
                        <Button onClick={loadDashboard}>다시 시도</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!stats) return null;

    const netIncome = stats.current_month.net_income;
    const isProfit = netIncome >= 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">대시보드</h1>
                <p className="text-gray-600 mt-1">
                    {new Date().toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'long',
                    })}
                </p>
            </div>

            {/* Stats Grid */}
            <div className={`grid grid-cols-1 md:grid-cols-2 ${canViewFinance ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-6`}>
                {/* 학생 현황 */}
                <StatsCard
                    title="수강 학생"
                    value={`${stats.students.active_students ?? 0}명`}
                    icon={Users}
                    iconBgColor="bg-blue-100"
                    iconColor="text-blue-600"
                />

                {/* 강사 현황 */}
                <StatsCard
                    title="근무 강사"
                    value={`${stats.instructors.active_instructors ?? 0}명`}
                    icon={UserCog}
                    iconBgColor="bg-purple-100"
                    iconColor="text-purple-600"
                />

                {/* 이번 달 수입 - 권한 체크 */}
                {canViewFinance && (
                    <StatsCard
                        title="이번 달 수입"
                        value={formatCurrency(stats.current_month.revenue.amount)}
                        icon={TrendingUp}
                        iconBgColor="bg-green-100"
                        iconColor="text-green-600"
                    />
                )}

                {/* 순수익 - 권한 체크 */}
                {canViewFinance && (
                    <StatsCard
                        title="순수익"
                        value={formatCurrency(netIncome)}
                        icon={Banknote}
                        iconBgColor={isProfit ? 'bg-emerald-100' : 'bg-orange-100'}
                        iconColor={isProfit ? 'text-emerald-600' : 'text-orange-600'}
                    />
                )}
            </div>

            {/* Action Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 오늘의 할 일 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">오늘의 할 일</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* 미납 학원비 - 권한 체크 */}
                        {canViewUnpaid && stats.unpaid_payments.count > 0 && (
                            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                        <AlertCircle className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900">미납 학원비</div>
                                        <div className="text-sm text-gray-600">
                                            {stats.unpaid_payments.count}건 (
                                            {formatCurrency(stats.unpaid_payments.amount)})
                                        </div>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => router.push('/payments?status=unpaid')}>
                                    확인하기
                                </Button>
                            </div>
                        )}

                        {/* 전체 학생 현황 */}
                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Users className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <div className="font-medium text-gray-900">전체 학생</div>
                                    <div className="text-sm text-gray-600">
                                        수강 {stats.students.active_students ?? 0}명 / 휴원{' '}
                                        {stats.students.paused_students ?? 0}명
                                    </div>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => router.push('/students')}>
                                관리하기
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 최근 활동 - 권한에 따라 다르게 표시 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">최근 활동</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {canViewFinance ? (
                                <>
                                    <div className="flex items-start space-x-3">
                                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900">
                                                이번 달 수입 {formatCurrency(stats.current_month.revenue.amount)}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {stats.current_month.revenue.count}건의 납부
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start space-x-3">
                                        <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900">
                                                이번 달 지출 {formatCurrency(stats.current_month.expenses.amount)}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {stats.current_month.expenses.count}건의 지출
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start space-x-3">
                                        <div
                                            className={`w-2 h-2 ${isProfit ? 'bg-emerald-500' : 'bg-orange-500'} rounded-full mt-2`}
                                        ></div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900">
                                                순수익 {formatCurrency(netIncome)}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {stats.current_month.month}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-gray-500 py-4">
                                    <p className="text-sm">학생 {stats.students.active_students ?? 0}명 관리 중</p>
                                    <p className="text-sm">강사 {stats.instructors.active_instructors ?? 0}명 근무 중</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

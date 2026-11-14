import { Banknote, Clock, TrendingUp, UserCog, Users, WalletCards } from 'lucide-react';
import { DashboardStats } from '@/lib/types';
import { StatTile, type Tone } from '@/components/ui/page';
import type { DashboardPermissions } from './dashboard-types';
import { formatCompactCurrency, toSafeNumber } from './dashboard-utils';

interface DashboardKpiStripProps {
    stats: DashboardStats;
    permissions: DashboardPermissions;
    amountsVisible: boolean;
}

interface KpiItem {
    label: string;
    value: string;
    note: string;
    tone?: 'normal' | 'good' | 'warn' | 'bad';
    icon: React.ComponentType<{ className?: string }>;
}

const toneOf = {
    normal: 'neutral',
    good: 'success',
    warn: 'warning',
    bad: 'danger',
} satisfies Record<NonNullable<KpiItem['tone']>, Tone>;

function getProtectedAmount(amountsVisible: boolean, value: string): string {
    return amountsVisible ? value : '••••';
}

function getNetIncomeNote(amountsVisible: boolean, netIncome: number): string {
    if (!amountsVisible) return '비밀번호 확인 필요';
    return netIncome >= 0
        ? `흑자 ${formatCompactCurrency(netIncome)}`
        : `적자 ${formatCompactCurrency(Math.abs(netIncome))}`;
}

export function DashboardKpiStrip({ stats, permissions, amountsVisible }: DashboardKpiStripProps) {
    const netIncome = toSafeNumber(stats.current_month.net_income);
    const items: KpiItem[] = [
        {
            label: '수강 학생',
            value: `${toSafeNumber(stats.students.active_students).toLocaleString()}명`,
            note: `전체 ${toSafeNumber(stats.students.total_students).toLocaleString()}명`,
            icon: Users,
        },
        {
            label: '근무 강사',
            value: `${toSafeNumber(stats.instructors.active_instructors).toLocaleString()}명`,
            note: `전체 ${toSafeNumber(stats.instructors.total_instructors).toLocaleString()}명`,
            icon: UserCog,
        },
    ];

    if (permissions.finance) {
        items.push(
            {
                label: '이번 달 수입',
                value: getProtectedAmount(amountsVisible, formatCompactCurrency(stats.current_month.revenue.amount)),
                note: `${stats.current_month.revenue.count}건 납부`,
                tone: 'good',
                icon: TrendingUp,
            },
            {
                label: '순수익',
                value: getProtectedAmount(amountsVisible, formatCompactCurrency(netIncome)),
                note: getNetIncomeNote(amountsVisible, netIncome),
                tone: netIncome >= 0 ? 'good' : 'warn',
                icon: Banknote,
            }
        );
    }

    if (permissions.unpaid) {
        items.push({
            label: '미납',
            value: getProtectedAmount(amountsVisible, formatCompactCurrency(stats.unpaid_payments.amount)),
            note: `${stats.unpaid_payments.count}건 확인 필요`,
            tone: stats.unpaid_payments.count > 0 ? 'bad' : 'good',
            icon: WalletCards,
        });
    }

    items.push({
        label: '휴원 종료',
        value: `${stats.rest_ended_students?.count || 0}명`,
        note: '복귀 처리 대기',
        tone: (stats.rest_ended_students?.count || 0) > 0 ? 'warn' : 'normal',
        icon: Clock,
    });

    return (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="오늘 숫자">
            {items.map((item) => (
                <StatTile
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    note={item.note}
                    tone={toneOf[item.tone || 'normal']}
                    icon={item.icon}
                />
            ))}
        </section>
    );
}

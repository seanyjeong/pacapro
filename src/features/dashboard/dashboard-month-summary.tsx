import { ArrowDownRight, ArrowUpRight, Banknote, LockKeyhole, Users, UserCog } from 'lucide-react';
import { DashboardStats } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/format';
import type { DashboardPermissions } from './dashboard-types';
import { getNetIncomeLabel, toSafeNumber } from './dashboard-utils';
import { ListRow, SectionCard, StatTile, toneText, type Tone } from '@/components/ui/page';

interface DashboardMonthSummaryProps {
    stats: DashboardStats;
    permissions: DashboardPermissions;
    amountsVisible: boolean;
}

function getProtectedAmount(amountsVisible: boolean, value: string): string {
    return amountsVisible ? value : '금액 숨김';
}

function getSummaryBadge(amountsVisible: boolean, isProfit: boolean): string {
    if (!amountsVisible) return '금액 가림';
    return isProfit ? '수익 유지' : '지출 확인';
}

export function DashboardMonthSummary({ stats, permissions, amountsVisible }: DashboardMonthSummaryProps) {
    const netIncome = toSafeNumber(stats.current_month.net_income);
    const isProfit = netIncome >= 0;

    if (!permissions.finance) {
        return (
            <SectionCard title="운영 요약" description="권한에 맞춰 재무 정보는 숨겨져 있어요.">
                <div className="grid gap-3 sm:grid-cols-3">
                    <StatTile className="bg-muted" label="수강 학생" icon={Users} value={`${stats.students.active_students ?? 0}명`} />
                    <StatTile className="bg-muted" label="근무 강사" icon={UserCog} value={`${stats.instructors.active_instructors ?? 0}명`} />
                    <StatTile className="bg-muted" label="재무 정보" icon={LockKeyhole} value="권한 필요" />
                </div>
            </SectionCard>
        );
    }

    return (
        <SectionCard
            title="이번 달"
            description={stats.current_month.month}
            actions={<span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-secondary-foreground">{getSummaryBadge(amountsVisible, isProfit)}</span>}
        >
            <div className="divide-y divide-border/60">
                <MoneyRow
                    icon={ArrowUpRight}
                    label="수입"
                    detail={`${stats.current_month.revenue.count}건 납부`}
                    amount={getProtectedAmount(amountsVisible, formatCurrency(stats.current_month.revenue.amount))}
                    tone="success"
                />
                <MoneyRow
                    icon={ArrowDownRight}
                    label="지출"
                    detail={`${stats.current_month.expenses.count}건 지출`}
                    amount={getProtectedAmount(amountsVisible, formatCurrency(stats.current_month.expenses.amount))}
                    tone="danger"
                />
                <MoneyRow
                    icon={Banknote}
                    label="순수익"
                    detail={amountsVisible ? getNetIncomeLabel(stats) : '비밀번호 확인 후 보여 드려요'}
                    amount={getProtectedAmount(amountsVisible, formatCurrency(netIncome))}
                    tone={isProfit ? 'primary' : 'warning'}
                />
            </div>
        </SectionCard>
    );
}

function MoneyRow({ icon, label, detail, amount, tone }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    detail: string;
    amount: string;
    tone: Tone;
}) {
    return (
        <ListRow
            icon={icon}
            tone={tone}
            title={label}
            detail={detail}
            trailing={<span className={`text-[17px] font-bold tabular-nums ${toneText[tone]}`}>{amount}</span>}
        />
    );
}

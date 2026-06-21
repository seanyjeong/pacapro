import { ArrowDownRight, ArrowUpRight, Banknote, LockKeyhole, Users, UserCog } from 'lucide-react';
import { DashboardStats } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/format';
import type { DashboardPermissions } from './dashboard-types';
import { getNetIncomeLabel, toSafeNumber } from './dashboard-utils';

interface DashboardMonthSummaryProps {
    stats: DashboardStats;
    permissions: DashboardPermissions;
}

export function DashboardMonthSummary({ stats, permissions }: DashboardMonthSummaryProps) {
    const netIncome = toSafeNumber(stats.current_month.net_income);
    const isProfit = netIncome >= 0;

    if (!permissions.finance) {
        return (
            <section className="rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                    <h2 className="text-sm font-semibold text-foreground">운영 요약</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">권한에 맞춰 재무 정보는 숨겨져 있습니다.</p>
                </div>
                <div className="grid gap-1 bg-border md:grid-cols-3">
                    <SummaryCell icon={Users} label="수강 학생" value={`${stats.students.active_students ?? 0}명`} />
                    <SummaryCell icon={UserCog} label="근무 강사" value={`${stats.instructors.active_instructors ?? 0}명`} />
                    <SummaryCell icon={LockKeyhole} label="재무 정보" value="권한 필요" muted />
                </div>
            </section>
        );
    }

    return (
        <section className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold text-foreground">이번 달 현황</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{stats.current_month.month}</p>
                </div>
                <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                    {isProfit ? '수익 유지' : '지출 확인'}
                </span>
            </div>
            <div className="divide-y divide-border">
                <MoneyRow
                    icon={ArrowUpRight}
                    label="수입"
                    detail={`${stats.current_month.revenue.count}건 납부`}
                    amount={formatCurrency(stats.current_month.revenue.amount)}
                    tone="good"
                />
                <MoneyRow
                    icon={ArrowDownRight}
                    label="지출"
                    detail={`${stats.current_month.expenses.count}건 지출`}
                    amount={formatCurrency(stats.current_month.expenses.amount)}
                    tone="bad"
                />
                <MoneyRow
                    icon={Banknote}
                    label="순수익"
                    detail={getNetIncomeLabel(stats)}
                    amount={formatCurrency(netIncome)}
                    tone={isProfit ? 'good' : 'warn'}
                />
            </div>
        </section>
    );
}

function SummaryCell({
    icon: Icon,
    label,
    value,
    muted,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    muted?: boolean;
}) {
    return (
        <div className="bg-card p-4">
            <Icon className="mb-3 h-4 w-4 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={muted ? 'mt-1 text-sm font-semibold text-muted-foreground' : 'mt-1 text-xl font-semibold text-foreground'}>{value}</div>
        </div>
    );
}

function MoneyRow({
    icon: Icon,
    label,
    detail,
    amount,
    tone,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    detail: string;
    amount: string;
    tone: 'good' | 'bad' | 'warn';
}) {
    const toneClass = {
        good: 'text-emerald-700 dark:text-emerald-300',
        bad: 'text-red-700 dark:text-red-300',
        warn: 'text-amber-700 dark:text-amber-300',
    };

    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/40">
                <Icon className={toneClass[tone]} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground">{detail}</div>
            </div>
            <div className={`text-right text-sm font-semibold ${toneClass[tone]}`}>{amount}</div>
        </div>
    );
}

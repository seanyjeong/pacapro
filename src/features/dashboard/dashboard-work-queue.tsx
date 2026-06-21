import { Banknote, Calendar, ChevronRight, Clock, MessageCircle, PlayCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { DashboardStats } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/format';
import type { Consultation } from '@/lib/types/consultation';
import type { DashboardPermissions, DashboardTone, InstructorSlotMap, WorkQueueItem } from './dashboard-types';
import {
    formatConsultationSummary,
    formatInstructorSlots,
    hasInstructorSchedule,
} from './dashboard-utils';

interface DashboardWorkQueueProps {
    stats: DashboardStats;
    permissions: DashboardPermissions;
    instructorsBySlot: InstructorSlotMap;
    todayConsultations: Consultation[];
    todayDataError: string | null;
    onNavigate: (href: string) => void;
    onOpenRestEnded: () => void;
    onRefresh: () => void;
}

const toneClass: Record<DashboardTone, string> = {
    accent: 'border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-900/70 dark:bg-teal-950/30 dark:text-teal-100',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100',
    warning: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100',
    danger: 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100',
    neutral: 'border-border bg-muted/40 text-foreground',
};

function buildQueueItems({
    stats,
    permissions,
    instructorsBySlot,
    todayConsultations,
    onOpenRestEnded,
}: Pick<DashboardWorkQueueProps, 'stats' | 'permissions' | 'instructorsBySlot' | 'todayConsultations' | 'onOpenRestEnded'>): WorkQueueItem[] {
    const items: WorkQueueItem[] = [];

    if (permissions.unpaid && stats.unpaid_payments.count > 0) {
        items.push({
            id: 'unpaid',
            title: '미납 학원비',
            detail: `${stats.unpaid_payments.count}건 · ${formatCurrency(stats.unpaid_payments.amount)}`,
            badge: '확인 필요',
            tone: 'danger',
            icon: Banknote,
            href: '/payments?status=unpaid',
        });
    }

    if ((stats.rest_ended_students?.count || 0) > 0) {
        items.push({
            id: 'rest-ended',
            title: '휴원 종료 대기',
            detail: `${stats.rest_ended_students?.count || 0}명 복귀 처리 필요`,
            badge: '복귀',
            tone: 'warning',
            icon: PlayCircle,
            action: onOpenRestEnded,
        });
    }

    if (permissions.schedules && hasInstructorSchedule(instructorsBySlot)) {
        items.push({
            id: 'instructors',
            title: '오늘 강사 일정',
            detail: formatInstructorSlots(instructorsBySlot),
            badge: '일정',
            tone: 'accent',
            icon: Clock,
            href: '/schedules',
        });
    }

    if (permissions.consultations && todayConsultations.length > 0) {
        items.push({
            id: 'consultations',
            title: '오늘 상담 일정',
            detail: formatConsultationSummary(todayConsultations),
            badge: '상담',
            tone: 'success',
            icon: MessageCircle,
            href: '/consultations',
        });
    }

    return items;
}

export function DashboardWorkQueue(props: DashboardWorkQueueProps) {
    const items = buildQueueItems(props);

    return (
        <aside className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold text-foreground">오늘의 업무</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{items.length}건 처리 대기</p>
                </div>
                <Button variant="outline" size="icon-sm" onClick={props.onRefresh} title="새로고침">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {props.todayDataError && (
                <div className="mx-4 mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
                    {props.todayDataError}
                </div>
            )}

            <div className="space-y-2 p-4">
                {items.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                        <Calendar className="mx-auto h-6 w-6 text-muted-foreground" />
                        <p className="mt-3 text-sm font-medium text-foreground">오늘 처리할 긴급 업무가 없습니다</p>
                        <p className="mt-1 text-xs text-muted-foreground">상담, 일정, 미납 항목이 생기면 여기에 먼저 표시됩니다.</p>
                    </div>
                ) : (
                    items.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => item.href ? props.onNavigate(item.href) : item.action?.()}
                                className={cn(
                                    'group flex w-full items-start justify-between gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/50',
                                    toneClass[item.tone]
                                )}
                            >
                                <span className="flex min-w-0 gap-3">
                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-card/70">
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-2">
                                            <span className="truncate text-sm font-semibold">{item.title}</span>
                                            <span className="rounded border border-current/20 px-1.5 py-0.5 text-[11px] font-medium">{item.badge}</span>
                                        </span>
                                        <span className="mt-1 block line-clamp-2 text-xs opacity-80">{item.detail}</span>
                                    </span>
                                </span>
                                <ChevronRight className="mt-1 h-4 w-4 shrink-0 opacity-55 transition-transform group-hover:translate-x-0.5" />
                            </button>
                        );
                    })
                )}
            </div>
        </aside>
    );
}

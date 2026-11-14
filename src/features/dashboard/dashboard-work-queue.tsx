import { Banknote, CalendarCheck, Clock, MessageCircle, PlayCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ListRow, SectionCard, type Tone } from '@/components/ui/page';
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
    amountsVisible: boolean;
    onNavigate: (href: string) => void;
    onOpenRestEnded: () => void;
    onRefresh: () => void;
}

const toneOf: Record<DashboardTone, Tone> = {
    accent: 'primary',
    success: 'success',
    warning: 'warning',
    danger: 'danger',
    neutral: 'neutral',
};

function buildQueueItems({
    stats,
    permissions,
    instructorsBySlot,
    todayConsultations,
    amountsVisible,
    onOpenRestEnded,
}: Pick<DashboardWorkQueueProps, 'stats' | 'permissions' | 'instructorsBySlot' | 'todayConsultations' | 'amountsVisible' | 'onOpenRestEnded'>): WorkQueueItem[] {
    const items: WorkQueueItem[] = [];

    if (permissions.unpaid && stats.unpaid_payments.count > 0) {
        items.push({
            id: 'unpaid',
            title: '미납 학원비',
            detail: amountsVisible
                ? `${stats.unpaid_payments.count}건 · ${formatCurrency(stats.unpaid_payments.amount)}`
                : `${stats.unpaid_payments.count}건 · 금액 숨김`,
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
        <SectionCard
            title="오늘 할 일"
            description={items.length > 0 ? `${items.length}건이 기다리고 있어요` : undefined}
            actions={(
                <Button variant="ghost" size="icon-sm" onClick={props.onRefresh} title="새로고침" aria-label="오늘 할 일 새로고침">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            )}
        >
            {props.todayDataError && (
                <p className="mb-2 rounded-xl bg-warning-soft px-3 py-2 text-[13px] font-medium text-warning">{props.todayDataError}</p>
            )}
            {items.length === 0 ? (
                <EmptyState icon={CalendarCheck} title="오늘 처리할 일이 없어요" description="상담·일정·미납이 생기면 여기에 먼저 보여 드려요." />
            ) : (
                <div className="divide-y divide-border/60">
                    {items.map((item) => (
                        <ListRow
                            key={item.id}
                            icon={item.icon}
                            tone={toneOf[item.tone]}
                            title={item.title}
                            detail={item.detail}
                            trailing={<span className="text-[13px] font-semibold text-muted-foreground">{item.badge}</span>}
                            onClick={() => item.href ? props.onNavigate(item.href) : item.action?.()}
                        />
                    ))}
                </div>
            )}
        </SectionCard>
    );
}

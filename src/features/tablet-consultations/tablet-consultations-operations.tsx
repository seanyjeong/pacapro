import Link from 'next/link';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MessageSquare, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import type { Consultation } from '@/lib/types/consultation';
import {
  formatTabletConsultationTime,
  getTabletConsultationTotal,
  isActiveTabletConsultation,
  type TabletConsultationStats,
} from './tablet-consultations-utils';

interface TabletConsultationsOperationsProps {
  consultations: Consultation[];
  dateLabel: string;
  isToday: boolean;
  loading: boolean;
  stats: TabletConsultationStats;
  onDateMove: (delta: number) => void;
  onRefresh: () => void;
  onToday: () => void;
}

export function TabletConsultationsOperations({
  consultations,
  dateLabel,
  isToday,
  loading,
  stats,
  onDateMove,
  onRefresh,
  onToday,
}: TabletConsultationsOperationsProps) {
  const nextConsultation = consultations.find((consultation) => isActiveTabletConsultation(consultation.status)) || consultations[0] || null;

  return (
    <section className="rounded-md border border-border bg-background p-4 shadow-none" aria-label="상담 운영">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>{dateLabel}</span>
            {isToday ? <Badge variant="secondary">오늘</Badge> : null}
          </div>
          <h2 className="mt-1 text-xl font-semibold text-foreground">
            {isToday ? '오늘 상담 운영' : '선택일 상담 운영'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">상담 진행, 연결 학생, 연락 액션을 이 화면에서 바로 확인합니다.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => onDateMove(-1)} aria-label="이전 날짜">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant={isToday ? 'secondary' : 'outline'} onClick={onToday}>
            오늘
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => onDateMove(1)} aria-label="다음 날짜">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={onRefresh} disabled={loading} className="gap-2">
            <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <OperationMetric icon={CalendarDays} label="표시 상담" value={`${getTabletConsultationTotal(stats, consultations.length)}건`} />
        <OperationMetric icon={Clock3} label="대기" value={`${stats.pending || 0}건`} />
        <OperationMetric icon={MessageSquare} label="확정" value={`${stats.confirmed || 0}건`} />
        <OperationMetric icon={CheckCircle2} label="완료" value={`${stats.completed || 0}건`} />
      </div>

      <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
        {nextConsultation ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">다음 상담</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-foreground">{nextConsultation.student_name}</span>
                <Badge variant="outline">{formatTabletConsultationTime(nextConsultation.preferred_time)}</Badge>
                {nextConsultation.student_school ? <span className="text-sm text-muted-foreground">{nextConsultation.student_school}</span> : null}
              </div>
            </div>
            <Link
              href={`/tablet/consultations/${nextConsultation.id}/conduct`}
              aria-label={`${nextConsultation.student_name} 다음 상담 진행`}
              className={buttonVariants({ className: 'gap-2' })}
            >
              <MessageSquare className="h-4 w-4" />
              상담 진행
            </Link>
          </div>
        ) : (
          <div className="py-5 text-center text-sm text-muted-foreground">선택한 날짜에 진행할 상담이 없습니다.</div>
        )}
      </div>
    </section>
  );
}

interface OperationMetricProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function OperationMetric({ icon: Icon, label, value }: OperationMetricProps) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

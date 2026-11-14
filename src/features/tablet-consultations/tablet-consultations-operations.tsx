import Link from 'next/link';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MessageSquare, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageHeader, StatTile } from '@/components/ui/page';
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
    <>
      <PageHeader
        title={(
          <span className="flex items-center gap-2">
            {isToday ? '오늘 상담 운영' : '선택일 상담 운영'}
            {isToday ? <Badge variant="default" className="text-[13px]">오늘</Badge> : null}
          </span>
        )}
        description={`${dateLabel} · 상담 진행, 연결 학생, 연락을 여기서 바로 해요.`}
        actions={(
          <>
            <Button type="button" variant="outline" size="icon" onClick={() => onDateMove(-1)} aria-label="이전 날짜">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button type="button" variant={isToday ? 'secondary' : 'outline'} onClick={onToday}>
              오늘
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={() => onDateMove(1)} aria-label="다음 날짜">
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button type="button" variant="outline" onClick={onRefresh} disabled={loading}>
              <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
          </>
        )}
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="상담 운영">
        <StatTile icon={CalendarDays} label="표시 상담" tone="primary" value={`${getTabletConsultationTotal(stats, consultations.length)}건`} />
        <StatTile icon={Clock3} label="대기" tone="warning" value={`${stats.pending || 0}건`} />
        <StatTile icon={MessageSquare} label="확정" tone="primary" value={`${stats.confirmed || 0}건`} />
        <StatTile icon={CheckCircle2} label="완료" tone="success" value={`${stats.completed || 0}건`} />
      </section>

      <section className="rounded-2xl bg-card p-5" aria-label="다음 상담">
        {nextConsultation ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-muted-foreground">다음 상담</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-[17px] font-bold text-foreground">{nextConsultation.student_name}</span>
                  <Badge variant="default">{formatTabletConsultationTime(nextConsultation.preferred_time)}</Badge>
                  {nextConsultation.student_school ? <span className="text-sm text-muted-foreground">{nextConsultation.student_school}</span> : null}
                </div>
              </div>
            </div>
            <Link
              href={`/tablet/consultations/${nextConsultation.id}/conduct`}
              aria-label={`${nextConsultation.student_name} 다음 상담 진행`}
              className={buttonVariants({ className: 'shrink-0' })}
            >
              <MessageSquare className="h-4 w-4" />
              상담 진행
            </Link>
          </div>
        ) : (
          <p className="py-3 text-center text-sm text-muted-foreground">선택한 날짜에 진행할 상담이 없어요.</p>
        )}
      </section>
    </>
  );
}

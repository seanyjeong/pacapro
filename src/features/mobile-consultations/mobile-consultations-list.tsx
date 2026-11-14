import { ChevronRight, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/page';
import { cn } from '@/lib/utils/cn';
import { MobileErrorCard, MobileSkeleton } from '../mobile-home/mobile-screen';
import { CONSULTATION_STATUS_META } from './mobile-consultations-constants';
import type { MobileConsultationsListProps } from './mobile-consultations-types';
import { formatGrade, formatTime, isFinishedStatus } from './mobile-consultations-utils';

export function MobileConsultationsList({ consultations, loading, error, stats, onOpen, onRetry }: MobileConsultationsListProps) {
  if (loading) {
    return <MobileSkeleton className="h-20" testId="mobile-consultations-loading" />;
  }

  if (error) {
    return <MobileErrorCard message={error} onRetry={onRetry} />;
  }

  const summary = [
    { label: '진행', value: stats.active, className: 'text-primary' },
    { label: '대기', value: stats.pending, className: 'text-warning' },
    { label: '완료', value: stats.finished, className: 'text-foreground' },
  ];

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-3 rounded-2xl bg-card py-4" aria-label="상담 요약">
        {summary.map((item) => (
          <div key={item.label} className="text-center">
            <p className={cn('text-[22px] font-extrabold leading-tight tabular-nums', item.className)}>{item.value}건</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </section>

      {consultations.length === 0 ? (
        <div className="rounded-2xl bg-card">
          <EmptyState icon={MessageSquare} title="예정된 상담이 없어요" />
        </div>
      ) : (
        <section className="rounded-2xl bg-card p-2" aria-label="상담 목록">
          <ul className="divide-y divide-border/60">
            {consultations.map((consultation) => {
              const finished = isFinishedStatus(consultation.status);
              const status = CONSULTATION_STATUS_META[consultation.status];
              const [period, clock] = formatTime(consultation.preferred_time).split(' ');
              const detail = [consultation.student_grade && formatGrade(consultation.student_grade), consultation.student_school].filter(Boolean).join(' · ');
              return (
                <li key={consultation.id}>
                  <button
                    type="button"
                    data-testid="mobile-consultation-card"
                    onClick={() => onOpen(consultation)}
                    className={cn('flex min-h-[68px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted active:bg-muted', finished && 'opacity-60')}
                  >
                    <span className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <span className="text-[11px] font-semibold leading-none">{period}</span>
                      <span className="mt-1 text-[15px] font-extrabold leading-none tabular-nums">{clock}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn('truncate text-[16px] font-bold', finished ? 'text-muted-foreground line-through' : 'text-foreground')}>
                          {consultation.student_name}
                        </span>
                        <Badge variant={status.badgeVariant} className="shrink-0">{status.label}</Badge>
                      </span>
                      {detail && <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{detail}</span>}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

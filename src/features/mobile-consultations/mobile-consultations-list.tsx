import { Clock, MessageSquare, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CONSULTATION_STATUS_META } from './mobile-consultations-constants';
import type { MobileConsultationsListProps } from './mobile-consultations-types';
import { formatGrade, formatTime, isFinishedStatus } from './mobile-consultations-utils';

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{value}건</p>
    </div>
  );
}

export function MobileConsultationsList({ consultations, loading, error, stats, onOpen, onRetry }: MobileConsultationsListProps) {
  if (loading) {
    return (
      <div className="space-y-3" data-testid="mobile-consultations-loading">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-24 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <p className="text-sm font-medium">{error}</p>
        <Button variant="outline" className="mt-3 w-full border-rose-200 bg-white dark:border-rose-800 dark:bg-zinc-950" onClick={onRetry}>
          다시 불러오기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-3 gap-2" aria-label="상담 요약">
        <SummaryPill label="진행" value={stats.active} />
        <SummaryPill label="대기" value={stats.pending} />
        <SummaryPill label="완료" value={stats.finished} />
      </section>

      {consultations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
          <MessageSquare className="mx-auto h-10 w-10 text-zinc-400" />
          <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">예정된 상담이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {consultations.map((consultation) => {
            const finished = isFinishedStatus(consultation.status);
            const status = CONSULTATION_STATUS_META[consultation.status];
            return (
              <button
                key={consultation.id}
                type="button"
                data-testid="mobile-consultation-card"
                onClick={() => onOpen(consultation)}
                className={`w-full rounded-lg border border-zinc-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-950 ${finished ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className={`truncate text-lg font-semibold ${finished ? 'text-zinc-500 line-through' : 'text-zinc-950 dark:text-zinc-50'}`}>
                        {consultation.student_name}
                      </p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatTime(consultation.preferred_time)}</span>
                      {consultation.student_grade && <span>{formatGrade(consultation.student_grade)}</span>}
                      {consultation.student_school && <span className="truncate">{consultation.student_school}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

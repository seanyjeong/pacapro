import Link from 'next/link';
import { Calendar, CheckCircle2, Clock, MessageSquare, Phone, School, Send, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import type { Consultation } from '@/lib/types/consultation';
import {
  CONSULTATION_STATUS_COLORS,
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_TYPE_LABELS,
  LEARNING_TYPE_LABELS,
} from '@/lib/types/consultation';
import { cn } from '@/lib/utils';
import {
  formatTabletConsultationShortDate,
  formatTabletConsultationTime,
  getTabletConsultationPhone,
  type TabletConsultationDateFilter,
} from './tablet-consultations-utils';

interface TabletConsultationsListProps {
  consultations: Consultation[];
  dateFilter: TabletConsultationDateFilter;
}

export function TabletConsultationsList({ consultations, dateFilter }: TabletConsultationsListProps) {
  if (consultations.length === 0) {
    return (
      <section className="rounded-md border border-dashed border-border bg-background px-4 py-12 text-center">
        <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-3 text-base font-semibold text-foreground">
          {dateFilter === 'selected' ? '선택한 날짜에 상담이 없습니다' : '조건에 맞는 상담이 없습니다'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">날짜나 검색어를 바꾸면 다른 상담을 확인할 수 있습니다.</p>
      </section>
    );
  }

  return (
    <section className="space-y-2" aria-label="상담 목록">
      {consultations.map((consultation) => (
        <ConsultationRow key={consultation.id} consultation={consultation} showDate={dateFilter === 'all'} />
      ))}
    </section>
  );
}

function ConsultationRow({ consultation, showDate }: { consultation: Consultation; showDate: boolean }) {
  const phone = getTabletConsultationPhone(consultation);
  const isCompleted = consultation.status === 'completed';
  const conductLabel = isCompleted ? '상담 내역 보기' : '상담 진행';
  const learningLabel = consultation.consultation_type === 'learning' && consultation.learning_type
    ? LEARNING_TYPE_LABELS[consultation.learning_type]
    : null;

  return (
    <article className="rounded-md border border-border bg-background p-3 shadow-none">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-muted/30">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="mt-1 text-xs font-semibold text-foreground">{formatTabletConsultationTime(consultation.preferred_time).replace('오전 ', '').replace('오후 ', '')}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{consultation.student_name}</h3>
              <Badge className={cn('border border-transparent', CONSULTATION_STATUS_COLORS[consultation.status])}>
                {CONSULTATION_STATUS_LABELS[consultation.status]}
              </Badge>
              <Badge variant="outline">{CONSULTATION_TYPE_LABELS[consultation.consultation_type]}</Badge>
              {learningLabel ? <Badge variant="secondary">{learningLabel}</Badge> : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-4 w-4" />
                {consultation.student_grade || '학년 미입력'}
              </span>
              {consultation.student_school ? (
                <span className="inline-flex items-center gap-1">
                  <School className="h-4 w-4" />
                  {consultation.student_school}
                </span>
              ) : null}
              {showDate ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatTabletConsultationShortDate(consultation.preferred_date)}
                </span>
              ) : null}
              {phone ? (
                <a href={`tel:${phone}`} className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline">
                  <Phone className="h-4 w-4" />
                  {phone}
                </a>
              ) : null}
            </div>

            {consultation.inquiry_content ? (
              <p className="mt-2 line-clamp-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {consultation.inquiry_content}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Link
            href={`/tablet/consultations/${consultation.id}/conduct`}
            aria-label={`${consultation.student_name} ${conductLabel}`}
            className={buttonVariants({ className: 'gap-2' })}
          >
            {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            {conductLabel}
          </Link>

          {consultation.linked_student_id ? (
            <>
              <Link
                href={`/tablet/students/${consultation.linked_student_id}`}
                aria-label={`${consultation.student_name} 학생 상세`}
                className={buttonVariants({ variant: 'outline', className: 'gap-2' })}
              >
                <UserRound className="h-4 w-4" />
                학생 상세
              </Link>
              <Link
                href={`/tablet/sms?studentId=${consultation.linked_student_id}`}
                aria-label={`${consultation.student_name} 문자 보내기`}
                className={buttonVariants({ variant: 'outline', className: 'gap-2' })}
              >
                <Send className="h-4 w-4" />
                문자
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

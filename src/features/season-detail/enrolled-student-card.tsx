import Link from 'next/link';
import { Loader2, Receipt, UserRound, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Season, StudentSeason, TimeSlot } from '@/lib/types/season';
import { formatSeasonFee } from '@/lib/types/season';
import { getEnrollmentTimeSlots, getSeasonPaymentAmounts, hasPaidSeasonAmount } from './season-detail-utils';
import { SeasonPaymentAmountSummary } from './season-payment-amount-summary';
import { SeasonPaymentStatusBadge } from './season-payment-status-badge';
import { SeasonTimeSlotToggleGroup } from './season-time-slot-toggle-group';

interface EnrolledStudentCardProps {
  season: Season;
  enrollment: StudentSeason;
  cancelling: boolean;
  updatingTimeSlot: boolean;
  onCancel: () => void;
  onOpenRefund: () => void;
  onTimeSlotChange: (slot: TimeSlot) => void;
}

export function EnrolledStudentCard({
  season,
  enrollment,
  cancelling,
  updatingTimeSlot,
  onCancel,
  onOpenRefund,
  onTimeSlotChange,
}: EnrolledStudentCardProps) {
  const { finalAmount } = getSeasonPaymentAmounts(enrollment);
  const seasonFee = finalAmount || Number(enrollment.season_fee) || 0;
  const discountAmount = Number(enrollment.discount_amount ?? 0) || 0;
  const originalFee = seasonFee + discountAmount;
  const timeSlots = getEnrollmentTimeSlots(season, enrollment);
  const isCancelled = enrollment.payment_status === 'cancelled';
  const hasPaidAmount = hasPaidSeasonAmount(enrollment);

  return (
    <article className="space-y-4 px-4 py-4" data-testid="enrolled-student-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            aria-label={`${enrollment.student_name ?? '학생'} 학생 상세`}
            className="inline-flex items-center gap-1.5 font-semibold text-foreground underline-offset-4 hover:underline"
            href={`/students/${enrollment.student_id}`}
          >
            <UserRound className="h-4 w-4 text-muted-foreground" />
            {enrollment.student_name ?? '-'}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {[enrollment.student_grade, enrollment.student_number].filter(Boolean).join(' · ') || '학생 정보'}
          </p>
        </div>
        <SeasonPaymentStatusBadge status={enrollment.payment_status} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">시즌비</p>
          {discountAmount > 0 ? (
            <div className="mt-1 space-y-0.5">
              <p className="text-xs text-muted-foreground line-through">{formatSeasonFee(originalFee)}</p>
              <p className="font-semibold text-foreground">{formatSeasonFee(seasonFee)}</p>
            </div>
          ) : (
            <p className="mt-1 font-semibold text-foreground">{formatSeasonFee(enrollment.season_fee)}</p>
          )}
          <SeasonPaymentAmountSummary enrollment={enrollment} />
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">등록일</p>
          <p className="mt-1 font-medium text-foreground">
            {enrollment.registration_date || enrollment.registered_at?.split('T')[0] || '-'}
          </p>
        </div>
      </div>

      {!isCancelled ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">시간대</p>
          <SeasonTimeSlotToggleGroup
            selectedSlots={timeSlots}
            updating={updatingTimeSlot}
            onChange={onTimeSlotChange}
          />
        </div>
      ) : null}

      {!isCancelled ? (
        <div className="flex justify-end gap-2">
          {hasPaidAmount ? (
            <Button className="text-orange-700 hover:text-orange-800" size="sm" type="button" variant="ghost" onClick={onOpenRefund}>
              <Receipt className="mr-1 h-4 w-4" />
              환불
            </Button>
          ) : (
            <Button
              className="text-rose-700 hover:text-rose-800"
              disabled={cancelling}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onCancel}
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="mr-1 h-4 w-4" />}
              {!cancelling ? '취소' : null}
            </Button>
          )}
        </div>
      ) : null}
    </article>
  );
}

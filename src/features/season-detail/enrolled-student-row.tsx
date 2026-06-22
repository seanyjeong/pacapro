import Link from 'next/link';
import { Loader2, Receipt, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Season, StudentSeason, TimeSlot } from '@/lib/types/season';
import { formatSeasonFee } from '@/lib/types/season';
import { getEnrollmentTimeSlots } from './season-detail-utils';
import { SeasonPaymentStatusBadge } from './season-payment-status-badge';
import { SeasonTimeSlotToggleGroup } from './season-time-slot-toggle-group';

interface EnrolledStudentRowProps {
  season: Season;
  enrollment: StudentSeason;
  cancelling: boolean;
  updatingTimeSlot: boolean;
  onCancel: () => void;
  onOpenRefund: () => void;
  onTimeSlotChange: (slot: TimeSlot) => void;
}

export function EnrolledStudentRow({
  season,
  enrollment,
  cancelling,
  updatingTimeSlot,
  onCancel,
  onOpenRefund,
  onTimeSlotChange,
}: EnrolledStudentRowProps) {
  const seasonFee = Number(enrollment.season_fee) || 0;
  const discountAmount = Number(enrollment.discount_amount ?? 0) || 0;
  const originalFee = seasonFee + discountAmount;
  const timeSlots = getEnrollmentTimeSlots(season, enrollment);
  const isCancelled = enrollment.payment_status === 'cancelled';

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/40">
      <td className="px-4 py-3">
        <Link
          aria-label={`${enrollment.student_name ?? '학생'} 학생 상세`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href={`/students/${enrollment.student_id}`}
        >
          {enrollment.student_name ?? '-'}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">
          {[enrollment.student_grade, enrollment.student_number].filter(Boolean).join(' · ') || '학생 정보'}
        </p>
      </td>
      <td className="px-4 py-3">
        {discountAmount > 0 ? (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground line-through">{formatSeasonFee(originalFee)}</p>
            <p className="text-sm font-semibold text-foreground">
              <span className="mr-1 text-rose-600">-{formatSeasonFee(discountAmount)}</span>
              {formatSeasonFee(seasonFee)}
            </p>
          </div>
        ) : (
          <span className="text-sm text-foreground">{formatSeasonFee(enrollment.season_fee)}</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {enrollment.registration_date || enrollment.registered_at?.split('T')[0] || '-'}
      </td>
      <td className="px-4 py-3">
        <SeasonPaymentStatusBadge status={enrollment.payment_status} />
      </td>
      <td className="px-4 py-3">
        {!isCancelled ? (
          <SeasonTimeSlotToggleGroup
            selectedSlots={timeSlots}
            updating={updatingTimeSlot}
            onChange={onTimeSlotChange}
          />
        ) : null}
      </td>
      <td className="px-4 py-3 text-right">
        {!isCancelled ? (
          <div className="flex justify-end gap-1">
            {enrollment.payment_status === 'paid' ? (
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
      </td>
    </tr>
  );
}

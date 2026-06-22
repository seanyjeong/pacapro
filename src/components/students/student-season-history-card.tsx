import {
  Banknote,
  Calendar,
  Check,
  Edit2,
  Loader2,
  Plus,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import type { StudentSeason } from '@/lib/types/season';
import {
  formatSeasonFee,
  STUDENT_SEASON_STATUS_LABELS,
} from '@/lib/types/season';

interface StudentSeasonHistoryCardProps {
  availableSeasonCount: number;
  enrollments: StudentSeason[];
  refundLoading: boolean;
  selectedEnrollmentForRefund: StudentSeason | null;
  onCancel: (enrollment: StudentSeason) => void;
  onEdit: (enrollment: StudentSeason) => void;
  onOpenEnroll: () => void;
  onRefund: (enrollment: StudentSeason) => void;
}

export function StudentSeasonHistoryCard({
  availableSeasonCount,
  enrollments,
  refundLoading,
  selectedEnrollmentForRefund,
  onCancel,
  onEdit,
  onOpenEnroll,
  onRefund,
}: StudentSeasonHistoryCardProps) {
  const hasAvailableSeason = availableSeasonCount > 0;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center text-lg">
            <Trophy className="mr-2 h-5 w-5" />
            시즌 등록 현황
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            현재 등록 {enrollments.length}건 · 추가 가능 {availableSeasonCount}건
          </p>
        </div>
        {hasAvailableSeason ? (
          <Button type="button" onClick={onOpenEnroll}>
            <Plus className="mr-2 h-4 w-4" />
            시즌 등록
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {enrollments.length === 0 ? (
          <EmptySeasonState canEnroll={hasAvailableSeason} onOpenEnroll={onOpenEnroll} />
        ) : (
          <div className="space-y-3">
            {enrollments.map((enrollment, index) => (
              <SeasonEnrollmentRow
                key={enrollment.id || `enrollment-${index}`}
                enrollment={enrollment}
                refundLoading={refundLoading}
                selectedEnrollmentForRefund={selectedEnrollmentForRefund}
                onCancel={onCancel}
                onEdit={onEdit}
                onRefund={onRefund}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptySeasonState({
  canEnroll,
  onOpenEnroll,
}: {
  canEnroll: boolean;
  onOpenEnroll: () => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
      <Trophy className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
      <p className="text-sm font-medium text-foreground">등록된 시즌이 없습니다.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        시즌 대상 학생은 여기에서 등록일, 시즌비, 환불 흐름을 관리합니다.
      </p>
      {canEnroll ? (
        <Button className="mt-4" type="button" onClick={onOpenEnroll}>
          <Plus className="mr-2 h-4 w-4" />
          시즌 등록하기
        </Button>
      ) : null}
    </div>
  );
}

function SeasonEnrollmentRow({
  enrollment,
  refundLoading,
  selectedEnrollmentForRefund,
  onCancel,
  onEdit,
  onRefund,
}: {
  enrollment: StudentSeason;
  refundLoading: boolean;
  selectedEnrollmentForRefund: StudentSeason | null;
  onCancel: (enrollment: StudentSeason) => void;
  onEdit: (enrollment: StudentSeason) => void;
  onRefund: (enrollment: StudentSeason) => void;
}) {
  const canChangeEnrollment = enrollment.status === 'active' || enrollment.status === 'registered';
  const isRefunding = refundLoading && selectedEnrollmentForRefund?.id === enrollment.id;

  return (
    <div className="rounded-md border border-border bg-background p-4 transition-colors hover:bg-muted/30">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium text-foreground">{enrollment.season_name || '이름 없는 시즌'}</h4>
            <SeasonStatusBadge status={enrollment.status} />
            {canChangeEnrollment ? <PaymentStatusBadge status={enrollment.payment_status} /> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center">
              <Calendar className="mr-1 h-4 w-4" />
              등록일: {enrollment.registration_date || '미지정'}
            </span>
            <span className="inline-flex items-center">
              <Banknote className="mr-1 h-4 w-4" />
              시즌비: {formatEnrollmentFee(enrollment)}
            </span>
            {Number.parseFloat(String(enrollment.discount_amount || 0)) > 0 ? (
              <span className="text-rose-700">
                할인 {Math.floor(Number.parseFloat(String(enrollment.discount_amount))).toLocaleString()}원
              </span>
            ) : null}
            {enrollment.is_continuous ? (
              <span className="inline-flex items-center text-emerald-700">
                <Check className="mr-1 h-4 w-4" />
                연속등록
              </span>
            ) : null}
          </div>
        </div>

        {canChangeEnrollment ? (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              aria-label="시즌 등록 수정"
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={() => onEdit(enrollment)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            {enrollment.payment_status === 'paid' ? (
              <Button
                className="text-orange-700 hover:text-orange-800"
                disabled={refundLoading}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => onRefund(enrollment)}
              >
                {isRefunding ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <RotateCcw className="mr-1 h-3 w-3" />
                    환불
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="text-rose-700 hover:text-rose-800"
                size="sm"
                type="button"
                variant="outline"
                onClick={() => onCancel(enrollment)}
              >
                취소
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatEnrollmentFee(enrollment: StudentSeason) {
  return formatSeasonFee(
    (Number.parseFloat(enrollment.season_fee) > 0 ? enrollment.season_fee : null) ||
    (Number.parseFloat(enrollment.final_fee) > 0 ? enrollment.final_fee : null) ||
    '0'
  );
}

function SeasonStatusBadge({ status }: { status: StudentSeason['status'] }) {
  return (
    <span className={cn('rounded-full px-2 py-1 text-xs font-medium', statusTone(status))}>
      {status === 'cancelled' ? '취소됨' : STUDENT_SEASON_STATUS_LABELS[status]}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: StudentSeason['payment_status'] }) {
  return (
    <span className={cn('rounded-full px-2 py-1 text-xs font-medium', paymentTone(status))}>
      {paymentStatusLabel(status)}
    </span>
  );
}

function statusTone(status: StudentSeason['status']) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-800';
  if (status === 'registered') return 'bg-blue-100 text-blue-800';
  if (status === 'completed') return 'bg-muted text-muted-foreground';
  return 'bg-rose-100 text-rose-800';
}

function paymentTone(status: StudentSeason['payment_status']) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800';
  if (status === 'partial') return 'bg-amber-100 text-amber-800';
  if (status === 'cancelled') return 'bg-muted text-muted-foreground';
  return 'bg-rose-100 text-rose-800';
}

function paymentStatusLabel(status: StudentSeason['payment_status']) {
  if (status === 'paid') return '완납';
  if (status === 'partial') return '일부납부';
  if (status === 'cancelled') return '취소됨';
  return '미납';
}

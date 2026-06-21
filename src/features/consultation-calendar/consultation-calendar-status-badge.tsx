import { Badge } from '@/components/ui/badge';
import type { ConsultationStatus } from '@/lib/types/consultation';
import {
  CONSULTATION_STATUS_COLORS,
  CONSULTATION_STATUS_LABELS,
} from '@/lib/types/consultation';

interface ConsultationCalendarStatusBadgeProps {
  status: ConsultationStatus;
}

export function ConsultationCalendarStatusBadge({ status }: ConsultationCalendarStatusBadgeProps) {
  return (
    <Badge className={`${CONSULTATION_STATUS_COLORS[status]} text-xs`}>
      {CONSULTATION_STATUS_LABELS[status]}
    </Badge>
  );
}

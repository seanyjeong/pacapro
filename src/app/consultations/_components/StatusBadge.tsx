// consultations/_components/StatusBadge.tsx
import { Badge } from '@/components/ui/badge';
import type { ConsultationStatus } from '@/lib/types/consultation';
import { CONSULTATION_STATUS_LABELS, CONSULTATION_STATUS_COLORS } from '@/lib/types/consultation';

interface Props {
  status: ConsultationStatus;
}

export function StatusBadge({ status }: Props) {
  return (
    <Badge className={CONSULTATION_STATUS_COLORS[status]}>
      {CONSULTATION_STATUS_LABELS[status]}
    </Badge>
  );
}

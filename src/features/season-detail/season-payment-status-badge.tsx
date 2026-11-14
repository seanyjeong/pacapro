import { Badge } from '@/components/ui/badge';
import type { PaymentStatus } from '@/lib/types/season';
import { getPaymentStatusLabel } from './season-detail-utils';

interface SeasonPaymentStatusBadgeProps {
  status: PaymentStatus;
}

export function SeasonPaymentStatusBadge({ status }: SeasonPaymentStatusBadgeProps) {
  return (
    <Badge variant={getPaymentVariant(status)}>
      {getPaymentStatusLabel(status)}
    </Badge>
  );
}

function getPaymentVariant(status: PaymentStatus): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'paid') return 'success';
  if (status === 'partial') return 'warning';
  if (status === 'pending') return 'destructive';
  return 'secondary';
}

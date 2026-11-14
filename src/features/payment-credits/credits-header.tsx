import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface CreditsHeaderProps {
  loading: boolean;
  onReload: () => void;
}

export function CreditsHeader({ loading, onReload }: CreditsHeaderProps) {
  return (
    <PageHeader
      title="크레딧 관리"
      description="휴원, 환불, 수동 크레딧 잔액과 적용 상태를 확인해요."
      actions={(
        <Button type="button" variant="outline" size="icon" onClick={onReload} disabled={loading} aria-label="새로고침" title="새로고침">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      )}
    />
  );
}

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import { PerformanceJungsiLinkButton } from './performance-jungsi-link-button';
import type { JungsiStatus } from './performance-types';
import { isJungsiLinked, isJungsiReady } from './performance-utils';

interface PerformanceHeaderProps {
  status: JungsiStatus | null;
  statusError: string | null;
  statusLoading: boolean;
  onRefreshStatus: () => void;
}

export function PerformanceHeader({ status, statusError, statusLoading, onRefreshStatus }: PerformanceHeaderProps) {
  const ready = isJungsiReady(status, statusError);
  const linked = isJungsiLinked(status);

  return (
    <PageHeader
      title="성적관리"
      description="내신과 모의고사 성적을 한 화면에서 봐요."
      actions={
        <>
          <span
            className={cn(
              'inline-flex h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold',
              statusLoading ? 'bg-muted text-muted-foreground' : ready ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
            )}
            data-testid="performance-engine-status"
          >
            {statusLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                연결 확인 중
              </>
            ) : ready ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                정시엔진 연결됨
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                {statusError || linked ? '정시엔진 연결 확인 필요' : '정시엔진 연동 필요'}
              </>
            )}
          </span>
          <PerformanceJungsiLinkButton status={status} onRefresh={onRefreshStatus} />
        </>
      }
    />
  );
}

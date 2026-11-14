import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { MobileErrorCard, MobileIconButton, MobileScreen } from '../mobile-home/mobile-screen';

interface MobileCalendarShellProps {
  title: string;
  description: string;
  loading: boolean;
  error: boolean;
  errorMessage: string;
  onRetry: () => void;
  children: ReactNode;
}

export function MobileCalendarShell(props: MobileCalendarShellProps) {
  return (
    <MobileScreen
      title={props.title}
      description={props.description}
      actions={(
        <MobileIconButton label="일정 새로고침" disabled={props.loading} onClick={props.onRetry}>
          <RefreshCw className={`h-5 w-5 ${props.loading ? 'animate-spin' : ''}`} />
        </MobileIconButton>
      )}
    >
      {props.loading && <p role="status" className="px-1 text-sm text-muted-foreground">일정을 불러오는 중입니다.</p>}
      {props.error && <MobileErrorCard message={props.errorMessage} onRetry={props.onRetry} retryLabel="다시 시도" />}
      {props.children}
    </MobileScreen>
  );
}

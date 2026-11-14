import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface TabletSettingsHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

export function TabletSettingsHeader({ loading, onRefresh }: TabletSettingsHeaderProps) {
  return (
    <PageHeader
      title="태블릿 운영 설정"
      description="계정, 알림, 운영 설정 위치를 한 화면에서 확인해요."
      actions={(
        <Button type="button" variant="outline" onClick={onRefresh} disabled={loading}>
          <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      )}
    />
  );
}

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TabletSettingsHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

export function TabletSettingsHeader({ loading, onRefresh }: TabletSettingsHeaderProps) {
  return (
    <section className="rounded-md border border-border bg-background p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">태블릿 전용</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">태블릿 운영 설정</h1>
          <p className="mt-1 text-sm text-muted-foreground">계정, 알림, 운영 설정 위치를 한 화면에서 확인합니다.</p>
        </div>
        <Button type="button" variant="outline" onClick={onRefresh} disabled={loading} className="gap-2">
          <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>
    </section>
  );
}

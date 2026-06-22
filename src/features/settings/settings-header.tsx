import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SettingsHeaderProps {
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onSave: () => void;
}

export function SettingsHeader({ hasUnsavedChanges, isLoading, isSaving, onSave }: SettingsHeaderProps) {
  const statusText = isSaving ? '저장 중' : hasUnsavedChanges ? '변경 사항 있음' : '저장됨';
  const saveLabel = isSaving ? '저장 중...' : hasUnsavedChanges ? '저장' : '저장됨';

  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">설정</h1>
          <span className="rounded-full border border-border bg-muted/35 px-2.5 py-1 text-xs font-semibold text-foreground">
            {statusText}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">지점 운영 기준 관리</p>
      </div>
      <Button
        onClick={onSave}
        disabled={isLoading || isSaving || !hasUnsavedChanges}
        variant={hasUnsavedChanges ? 'default' : 'secondary'}
        className="w-full md:w-auto"
      >
        <Save className="mr-2 h-4 w-4" />
        {saveLabel}
      </Button>
    </header>
  );
}

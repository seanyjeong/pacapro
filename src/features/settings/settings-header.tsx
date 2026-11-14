import { Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

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
    <PageHeader
      title="설정"
      description="학원 운영 기준을 한곳에서 관리해요"
      actions={(
        <>
          <Badge variant={isSaving ? 'secondary' : hasUnsavedChanges ? 'warning' : 'success'} className="px-3 py-1 text-[13px]">
            {statusText}
          </Badge>
          <Button
            onClick={onSave}
            disabled={isLoading || isSaving || !hasUnsavedChanges}
            variant={hasUnsavedChanges ? 'default' : 'outline'}
          >
            <Save className="h-4 w-4" />
            {saveLabel}
          </Button>
        </>
      )}
    />
  );
}

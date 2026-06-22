import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SettingsHeaderProps {
  isLoading: boolean;
  isSaving: boolean;
  onSave: () => void;
}

export function SettingsHeader({ isLoading, isSaving, onSave }: SettingsHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">운영 기준 관리</p>
      </div>
      <Button onClick={onSave} disabled={isLoading || isSaving} className="w-full md:w-auto">
        <Save className="mr-2 h-4 w-4" />
        {isSaving ? '저장 중...' : '저장'}
      </Button>
    </header>
  );
}

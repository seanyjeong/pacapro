import { Loader2, Save, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  saving: boolean;
  selectedCount: number;
  totalSelectedCount: number;
  onRequestExtraDay?: () => void;
  onSave: () => void;
}

export function InstructorScheduleFooter({
  saving,
  selectedCount,
  totalSelectedCount,
  onRequestExtraDay,
  onSave,
}: Props) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <div className="text-sm text-muted-foreground">
        <p>현재 {selectedCount}명</p>
        <p className="text-xs">총 {totalSelectedCount}명 배정</p>
      </div>
      <div className="flex gap-2">
        {onRequestExtraDay && (
          <Button variant="outline" onClick={onRequestExtraDay}>
            <UserPlus className="mr-2 h-4 w-4" />
            미배정 출근
          </Button>
        )}
        <Button onClick={onSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          저장
        </Button>
      </div>
    </div>
  );
}

import { Button } from '@/components/ui/button';

interface FormActionsProps {
  mode: 'create' | 'edit';
  submitting: boolean;
  onCancel: () => void;
}

export function FormActions({ mode, submitting, onCancel }: FormActionsProps) {
  return (
    <div className="flex items-center justify-end space-x-3">
      <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
        취소
      </Button>
      <Button type="submit" disabled={submitting}>
        {submitting ? '저장 중...' : mode === 'create' ? '등록' : '수정'}
      </Button>
    </div>
  );
}

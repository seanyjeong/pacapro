import { FileSpreadsheet, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import { cn } from '@/lib/utils/cn';

interface ExpensesHeaderProps {
  exporting: boolean;
  showForm: boolean;
  editingId: number | null;
  canEdit: boolean;
  onExport: () => void;
  onCreateClick: () => void;
}

export function ExpensesHeader({
  exporting,
  showForm,
  editingId,
  canEdit,
  onExport,
  onCreateClick,
}: ExpensesHeaderProps) {
  return (
    <PageHeader
      title="지출 관리"
      description="운영비, 환불, 급여 연동 지출을 확인해요."
      actions={(
        <>
          <Button type="button" variant="outline" onClick={onExport} disabled={exporting}>
            <FileSpreadsheet className={cn('h-4 w-4', exporting && 'animate-pulse')} />
            {exporting ? '다운로드 중...' : '엑셀'}
          </Button>
          {canEdit ? (
            <Button type="button" onClick={onCreateClick}>
              <Plus className="h-4 w-4" />
              {showForm && !editingId ? '취소' : '지출 등록'}
            </Button>
          ) : null}
        </>
      )}
    />
  );
}

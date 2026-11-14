import { FileSpreadsheet, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import { cn } from '@/lib/utils/cn';

interface IncomesHeaderProps {
  exporting: boolean;
  showForm: boolean;
  editingId: number | null;
  canEdit: boolean;
  onExport: () => void;
  onCreateClick: () => void;
}

export function IncomesHeader({
  exporting,
  showForm,
  editingId,
  canEdit,
  onExport,
  onCreateClick,
}: IncomesHeaderProps) {
  return (
    <PageHeader
      title="수입 관리"
      description="학원비 수납과 기타 수입을 확인해요."
      actions={(
        <>
          <Button type="button" variant="outline" onClick={onExport} disabled={exporting}>
            <FileSpreadsheet className={cn('h-4 w-4', exporting && 'animate-pulse')} />
            {exporting ? '다운로드 중...' : '엑셀'}
          </Button>
          {canEdit ? (
            <Button type="button" onClick={onCreateClick}>
              <Plus className="h-4 w-4" />
              {showForm && !editingId ? '취소' : '기타수입 등록'}
            </Button>
          ) : null}
        </>
      )}
    />
  );
}

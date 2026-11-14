import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface SeasonListHeaderProps {
  onAddSeason: () => void;
  onRefresh: () => void;
}

export function SeasonListHeader({ onAddSeason, onRefresh }: SeasonListHeaderProps) {
  return (
    <PageHeader
      title="시즌 관리"
      description="수시·정시 시즌을 등록하고 학생을 배정해요."
      actions={
        <>
          <Button variant="outline" size="icon" onClick={onRefresh} aria-label="새로고침" title="새로고침">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={onAddSeason}>
            <Plus className="h-4 w-4" />
            시즌 등록
          </Button>
        </>
      }
    />
  );
}

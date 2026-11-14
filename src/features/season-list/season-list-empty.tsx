import { Plus, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/page';

interface SeasonListEmptyProps {
  onAddSeason: () => void;
}

export function SeasonListEmpty({ onAddSeason }: SeasonListEmptyProps) {
  return (
    <div className="pb-8">
      <EmptyState icon={Trophy} title="등록된 시즌이 없어요." />
      <div className="flex justify-center">
        <Button onClick={onAddSeason}>
          <Plus className="h-4 w-4" />
          첫 시즌 등록하기
        </Button>
      </div>
    </div>
  );
}

import { Plus, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SeasonListEmptyProps {
  onAddSeason: () => void;
}

export function SeasonListEmpty({ onAddSeason }: SeasonListEmptyProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white px-5 py-12 text-center">
      <Trophy className="mx-auto mb-4 h-12 w-12 text-slate-300" />
      <p className="text-sm text-slate-500">등록된 시즌이 없습니다.</p>
      <Button className="mt-4" onClick={onAddSeason}>
        <Plus className="mr-2 h-4 w-4" />
        첫 시즌 등록하기
      </Button>
    </section>
  );
}

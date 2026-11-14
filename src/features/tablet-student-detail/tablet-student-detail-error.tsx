import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TabletStudentDetailErrorProps {
  onBack: () => void;
  onRetry: () => void;
}

export function TabletStudentDetailError({ onBack, onRetry }: TabletStudentDetailErrorProps) {
  return (
    <div className="rounded-2xl bg-card p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><User className="h-6 w-6" /></span>
      <h1 className="mt-4 text-xl font-bold text-foreground">학생 정보를 불러오지 못했습니다</h1>
      <p className="mt-2 text-sm text-muted-foreground">잠시 후 다시 시도해주세요.</p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={onBack}>
          목록으로
        </Button>
        <Button type="button" onClick={onRetry}>
          다시 불러오기
        </Button>
      </div>
    </div>
  );
}

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudentDetailBackProps {
  onBack: () => void;
}

/** 학생 상세 맨 위 '목록으로' 버튼 */
export function StudentDetailBack({ onBack }: StudentDetailBackProps) {
  return (
    <Button className="-ml-2 text-muted-foreground" size="sm" type="button" variant="ghost" onClick={onBack}>
      <ArrowLeft className="h-4 w-4" />
      목록으로
    </Button>
  );
}

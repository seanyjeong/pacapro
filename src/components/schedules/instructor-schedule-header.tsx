import { UserCog, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  formattedDate: string;
  onClose?: () => void;
}

export function InstructorScheduleHeader({ formattedDate, onClose }: Props) {
  return (
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserCog className="h-5 w-5" />
          강사 근무 배정
        </CardTitle>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="강사 근무 배정 닫기">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{formattedDate}</p>
    </CardHeader>
  );
}

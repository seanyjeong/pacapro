import { AlertCircle, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorProps {
  message: string;
  onRetry: () => void;
}

export function InstructorScheduleNoDateState() {
  return (
    <Card>
      <CardContent className="p-8 text-center text-muted-foreground">
        <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>날짜를 선택하세요</p>
      </CardContent>
    </Card>
  );
}

export function InstructorScheduleLoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );
}

export function InstructorScheduleErrorState({ message, onRetry }: ErrorProps) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
        <div className="min-w-0 flex-1">
          <p>{message}</p>
          <Button variant="outline" size="sm" className="mt-3 bg-white" onClick={onRetry}>
            다시 시도
          </Button>
        </div>
      </div>
    </div>
  );
}

import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorProps {
  message: string;
  onRetry: () => void;
}

export function InstructorAttendanceLoadingState() {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">강사 목록을 불러오는 중...</p>
      </CardContent>
    </Card>
  );
}

export function InstructorAttendanceErrorState({ message, onRetry }: ErrorProps) {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <p className="text-red-600" role="alert">{message}</p>
        <Button onClick={onRetry} className="mt-4">다시 시도</Button>
      </CardContent>
    </Card>
  );
}

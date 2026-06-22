import { RefreshCw } from 'lucide-react';

export function TabletStudentDetailLoading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-center">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">학생 정보를 불러오는 중입니다.</p>
      </div>
    </div>
  );
}

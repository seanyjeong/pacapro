import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudentsPageErrorProps {
    onRetry: () => void;
}

export function StudentsPageError({ onRetry }: StudentsPageErrorProps) {
    return (
        <section
            className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"
            role="alert"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="space-y-1">
                        <h2 className="text-sm font-semibold">학생 정보를 불러오지 못했습니다</h2>
                        <p className="text-sm">잠시 후 다시 시도해 주세요.</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" type="button" className="gap-2" onClick={onRetry}>
                    <RefreshCw className="h-4 w-4" />
                    다시 불러오기
                </Button>
            </div>
        </section>
    );
}

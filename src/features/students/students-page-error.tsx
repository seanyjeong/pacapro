import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudentsPageErrorProps {
    onRetry: () => void;
}

export function StudentsPageError({ onRetry }: StudentsPageErrorProps) {
    return (
        <section className="rounded-2xl bg-warning-soft p-5 text-warning" role="alert">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="space-y-1">
                        <h2 className="text-[15px] font-bold">학생 정보를 불러오지 못했어요</h2>
                        <p className="text-sm">잠시 후 다시 시도해 주세요.</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" type="button" className="w-full sm:w-auto" onClick={onRetry}>
                    <RefreshCw className="h-4 w-4" />
                    다시 불러오기
                </Button>
            </div>
        </section>
    );
}

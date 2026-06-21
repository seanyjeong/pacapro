import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudentsPageErrorProps {
    onRetry: () => void;
}

export function StudentsPageError({ onRetry }: StudentsPageErrorProps) {
    return (
        <div className="space-y-5">
            <header>
                <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">PACA Student Desk</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">학생 운영</h1>
            </header>
            <section className="flex min-h-[320px] items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100">
                <div>
                    <AlertCircle className="mx-auto h-9 w-9" />
                    <h2 className="mt-4 text-base font-semibold">학생 정보를 불러오지 못했습니다</h2>
                    <p className="mt-2 text-sm text-red-800 dark:text-red-200">잠시 후 다시 시도해 주세요.</p>
                    <Button variant="outline" className="mt-5 gap-2" onClick={onRetry}>
                        <RefreshCw className="h-4 w-4" />
                        다시 불러오기
                    </Button>
                </div>
            </section>
        </div>
    );
}

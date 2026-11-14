import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardErrorStateProps {
    message: string;
    onRetry: () => void;
}

export function DashboardErrorState({ message, onRetry }: DashboardErrorStateProps) {
    return (
        <div className="flex min-h-[420px] items-center justify-center">
            <section className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive-soft p-6 text-center text-destructive">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-destructive-soft text-destructive">
                    <AlertCircle className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold">자료를 불러오지 못했습니다</h2>
                <p className="mt-2 text-sm text-destructive">{message}</p>
                <Button onClick={onRetry} className="mt-5 gap-2" variant="outline">
                    <RefreshCw className="h-4 w-4" />
                    다시 불러오기
                </Button>
            </section>
        </div>
    );
}

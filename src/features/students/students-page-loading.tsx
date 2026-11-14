import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';

export function StudentsPageLoading() {
    return (
        <div className="space-y-4">
            <PageHeader title="학생 운영" />
            <div className="flex min-h-[240px] items-center justify-center rounded-2xl bg-card">
                <div className="text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin" />
                    <p className="mt-3 text-sm">학생 화면을 준비하고 있어요.</p>
                </div>
            </div>
        </div>
    );
}

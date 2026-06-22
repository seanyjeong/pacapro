import { Loader2 } from 'lucide-react';

export function StudentsPageLoading() {
    return (
        <div className="space-y-5">
            <header>
                <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">PACA Student Desk</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">학생 운영</h1>
            </header>
            <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-border bg-card">
                <div className="text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin" />
                    <p className="mt-3 text-sm">학생 화면을 준비하는 중입니다.</p>
                </div>
            </div>
        </div>
    );
}

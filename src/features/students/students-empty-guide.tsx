import { AlertCircle } from 'lucide-react';

export function StudentsEmptyGuide() {
    return (
        <section className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5">
            <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                    <h2 className="text-sm font-semibold text-foreground">학생 등록을 시작하세요</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        학생을 등록하면 학원비, 성적, 출석, 상담 기록을 함께 관리할 수 있습니다.
                    </p>
                </div>
            </div>
        </section>
    );
}

import { UserPlus } from 'lucide-react';

export function StudentsEmptyGuide() {
    return (
        <section className="flex items-start gap-3 rounded-2xl bg-primary-soft px-5 py-4">
            <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
                <h2 className="text-[15px] font-bold text-foreground">학생 등록을 시작하세요</h2>
                <p className="mt-0.5 text-sm text-secondary-foreground">
                    학생을 등록하면 학원비·성적·출석·상담 기록을 함께 관리할 수 있어요.
                </p>
            </div>
        </section>
    );
}

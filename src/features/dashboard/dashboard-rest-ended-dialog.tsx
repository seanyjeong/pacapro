import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { RestEndedStudent } from '@/components/students/student-resume-modal';

interface DashboardRestEndedDialogProps {
    open: boolean;
    students: RestEndedStudent[];
    onOpenChange: (open: boolean) => void;
    onSelectStudent: (student: RestEndedStudent) => void;
}

export function DashboardRestEndedDialog({
    open,
    students,
    onOpenChange,
    onSelectStudent,
}: DashboardRestEndedDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>휴원 종료 대기 학생</DialogTitle>
                    <DialogDescription>
                        복귀 처리할 학생을 선택하세요.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-96 space-y-2 overflow-y-auto px-1 py-4">
                    {students.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                            휴원 종료 대기 중인 학생이 없습니다.
                        </div>
                    ) : (
                        students.map((student) => (
                            <button
                                key={student.id}
                                type="button"
                                onClick={() => onSelectStudent(student)}
                                className="w-full rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold text-foreground">{student.name}</div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            {student.grade || '학년 미등록'} · 종료일 {student.rest_end_date}
                                        </div>
                                    </div>
                                    <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
                                        {student.days_overdue}일 경과
                                    </span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

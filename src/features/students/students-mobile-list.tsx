import { Calendar, Phone, School, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Student } from '@/lib/types/student';
import { STATUS_LABELS } from '@/lib/types/student';
import {
    formatClassDays,
    formatCurrency,
    formatDate,
    formatPhoneNumber,
    getStatusColor,
    getStudentDisplayInfo,
} from '@/lib/utils/student-helpers';

interface StudentsMobileListProps {
    hideMonthlyTuition?: boolean;
    loading: boolean;
    students: Student[];
    onStudentClick: (id: number) => void;
}

export function StudentsMobileList({
    hideMonthlyTuition,
    loading,
    students,
    onStudentClick,
}: StudentsMobileListProps) {
    if (loading) {
        return (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                학생 목록을 불러오는 중입니다.
            </div>
        );
    }

    if (students.length === 0) {
        return (
            <div className="rounded-lg border border-border bg-card p-6 text-center">
                <p className="text-sm font-semibold text-foreground">표시할 학생이 없습니다</p>
                <p className="mt-1 text-xs text-muted-foreground">검색어나 필터를 조정해 주세요.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {students.map((student) => (
                <button
                    key={student.id}
                    type="button"
                    onClick={() => onStudentClick(student.id)}
                    className="w-full rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40"
                >
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <UserRound className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base font-semibold text-foreground">{student.name}</span>
                                <Badge className={`border text-xs ${getStatusColor(student.status)}`}>
                                    {STATUS_LABELS[student.status] || student.status}
                                </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {getStudentDisplayInfo(student)}
                                {student.school ? ` · ${student.school}` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-2">
                            <Phone className="h-4 w-4 shrink-0" />
                            {formatPhoneNumber(student.phone)}
                        </span>
                        <span className="flex items-center gap-2">
                            <School className="h-4 w-4 shrink-0" />
                            {formatClassDays(student.class_days)} · 주 {student.weekly_count}회
                        </span>
                        <span className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 shrink-0" />
                            등록 {formatDate(student.enrollment_date)}
                        </span>
                    </div>

                    {!hideMonthlyTuition && (
                        <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/45 px-3 py-2">
                            <span className="text-xs font-medium text-muted-foreground">월 학원비</span>
                            <span className="text-sm font-semibold text-foreground">
                                {formatCurrency(student.monthly_tuition)}
                            </span>
                        </div>
                    )}
                </button>
            ))}
        </div>
    );
}

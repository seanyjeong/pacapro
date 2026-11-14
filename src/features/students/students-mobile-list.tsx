import { ChevronRight, Loader2, Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/page';
import { StudentAvatar } from '@/components/students/student-avatar';
import type { Student } from '@/lib/types/student';
import {
    formatClassDays,
    formatPhoneNumber,
    getStudentDisplayInfo,
} from '@/lib/utils/student-helpers';
import { visibleParentName } from '@/lib/utils/student-parent-names';
import { StudentStatusBadge } from './student-status-badge';

interface StudentsMobileListProps {
    loading: boolean;
    students: Student[];
    onStudentClick: (id: number) => void;
    /** 지점·반을 쓰는 학원만: 학생의 지점·반 이름 */
    placementOf?: (student: Student) => string;
}

// 휴대폰 학생 목록: 한 명이 한 줄(사진 · 이름 + 상태 · 학년/지점·반 · 연락처).
export function StudentsMobileList({
    loading,
    students,
    onStudentClick,
    placementOf,
}: StudentsMobileListProps) {
    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                학생 목록을 불러오는 중이에요
            </div>
        );
    }

    if (students.length === 0) {
        return <EmptyState icon={Users} title="표시할 학생이 없어요" description="검색어나 필터를 바꿔 보세요." />;
    }

    return (
        <ul className="divide-y divide-border/60">
            {students.map((student) => {
                const placement = placementOf?.(student);
                const meta = [
                    getStudentDisplayInfo(student),
                    placement && placement !== '-' ? placement : null,
                    student.school || null,
                ].filter(Boolean).join(' · ');
                const father = visibleParentName(student.father_name);
                const mother = visibleParentName(student.mother_name);
                const parents = [father && `아버지 ${father}`, mother && `어머니 ${mother}`].filter(Boolean).join(' · ');

                return (
                    <li key={student.id} className="flex items-center gap-3 py-3">
                        <StudentAvatar student={student} />
                        <button
                            type="button"
                            aria-label={`${student.name} 상세 보기`}
                            onClick={() => onStudentClick(student.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl text-left transition-colors active:bg-muted"
                        >
                            <span className="min-w-0 flex-1">
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate text-[16px] font-bold text-foreground">{student.name}</span>
                                    <StudentStatusBadge status={student.status} className="shrink-0" />
                                </span>
                                <span className="mt-0.5 block truncate text-[13px] text-secondary-foreground">{meta}</span>
                                <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                                    {formatPhoneNumber(student.phone)} · {formatClassDays(student.class_days)} 주 {student.weekly_count}회
                                </span>
                                {parents && <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{parents}</span>}
                            </span>
                            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60" />
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

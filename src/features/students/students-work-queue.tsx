'use client';

import Link from 'next/link';
import { CalendarDays, ClipboardList, MessageSquareText, UserPlus, UsersRound } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import type { Student } from '@/lib/types/student';
import { cn } from '@/lib/utils/cn';
import type { StudentTab } from './student-page-types';
import { STUDENT_TABS } from './student-page-utils';

interface StudentSummaryStats {
    active: number;
    paused: number;
    pending: number;
    total: number;
    trial: number;
}

interface StudentsWorkQueueProps {
    activeTab: StudentTab;
    currentCount: number;
    stats: StudentSummaryStats;
    students: Student[];
    onAddStudent: () => void;
    onTabChange: (tab: StudentTab) => void;
    onStudentClick: (id: number) => void;
}

export function StudentsWorkQueue({
    activeTab,
    currentCount,
    stats,
    students,
    onAddStudent,
    onTabChange,
    onStudentClick,
}: StudentsWorkQueueProps) {
    const activeTabLabel = STUDENT_TABS.find((tab) => tab.id === activeTab)?.label || '학생';
    const focusStudent = students[0] || null;

    return (
        <div className="space-y-4" data-testid="students-work-queue">
            <section className="rounded-md border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                        <UsersRound className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-foreground">학생 운영 보드</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {activeTabLabel} 기준 현재 목록 {currentCount}명
                        </p>
                    </div>
                </div>

                <div className="mt-4 space-y-2">
                    <QueueRow label="현재 목록" value={`${currentCount}명`} />
                    <QueueRow
                        active={activeTab === 'active'}
                        ariaLabel="재원 학생 보기"
                        label="재원"
                        value={`${stats.active}명`}
                        onClick={() => onTabChange('active')}
                    />
                    <QueueRow
                        active={activeTab === 'paused'}
                        ariaLabel="휴원 학생 보기"
                        label="휴원"
                        value={`${stats.paused}명`}
                        onClick={() => onTabChange('paused')}
                    />
                    <QueueRow
                        active={activeTab === 'trial'}
                        ariaLabel="체험 학생 보기"
                        label="체험"
                        value={`${stats.trial}명`}
                        onClick={() => onTabChange('trial')}
                    />
                    <QueueRow
                        active={activeTab === 'pending'}
                        ariaLabel="미등록 학생 보기"
                        label="미등록"
                        value={`${stats.pending}명`}
                        onClick={() => onTabChange('pending')}
                    />
                </div>

                <Button className="mt-4 w-full justify-start gap-2" onClick={onAddStudent}>
                    <UserPlus className="h-4 w-4" />
                    학생 등록 시작
                </Button>
            </section>

            {focusStudent ? (
                <section className="rounded-md border border-border bg-card p-4">
                    <h2 className="text-sm font-semibold text-foreground">바로 확인할 학생</h2>
                    <p className="mt-2 text-sm font-medium text-foreground">{focusStudent.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {focusStudent.grade || focusStudent.student_type} {focusStudent.school ? `, ${focusStudent.school}` : ''}
                    </p>
                    <Button
                        className="mt-3 w-full justify-start gap-2"
                        variant="outline"
                        onClick={() => onStudentClick(focusStudent.id)}
                    >
                        <ClipboardList className="h-4 w-4" />
                        학생 상세
                    </Button>
                </section>
            ) : null}

            <section className="rounded-md border border-border bg-card p-4">
                <h2 className="text-sm font-semibold text-foreground">빠른 이동</h2>
                <div className="mt-3 space-y-2">
                    <Link className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start gap-2 whitespace-normal')} href="/students/class-days">
                        <CalendarDays className="h-4 w-4" />
                        수업일 관리
                    </Link>
                    <Link className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start gap-2 whitespace-normal')} href="/consultations/enrolled">
                        <ClipboardList className="h-4 w-4" />
                        상담 관리
                    </Link>
                    <Link className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start gap-2 whitespace-normal')} href="/sms">
                        <MessageSquareText className="h-4 w-4" />
                        문자 발송
                    </Link>
                </div>
            </section>
        </div>
    );
}

function QueueRow({
    active,
    ariaLabel,
    label,
    onClick,
    value,
}: {
    active?: boolean;
    ariaLabel?: string;
    label: string;
    onClick?: () => void;
    value: string;
}) {
    const className = cn(
        'grid w-full grid-cols-1 gap-1 rounded-md border px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3',
        onClick ? 'text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500/25' : '',
        active ? 'border-blue-300 bg-blue-50' : 'border-border bg-background',
        onClick && !active ? 'hover:border-border/80 hover:bg-muted/40' : ''
    );
    const content = (
        <>
            <span className="min-w-0 truncate text-muted-foreground">{label}</span>
            <span className="shrink-0 text-base font-semibold text-foreground sm:text-sm">{value}</span>
        </>
    );

    if (onClick) {
        return (
            <button aria-label={ariaLabel} aria-pressed={Boolean(active)} className={className} type="button" onClick={onClick}>
                {content}
            </button>
        );
    }

    return (
        <div className={className}>
            {content}
        </div>
    );
}

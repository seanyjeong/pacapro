import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    BookOpen,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    FileText,
    MessageSquare,
    PhoneCall,
    Target,
} from 'lucide-react';
import type { InitialConsultation } from './student-consultation-types';
import {
    INITIAL_GRADE_SUBJECTS,
    INITIAL_STATUS_LABELS,
    formatKoreanDate,
    formatUnknownValue,
    getChecklistInputValue,
    getChecklistLabel,
    isChecklistChecked,
    isRecord,
    parseJsonArray,
    parseJsonRecord,
} from './student-consultation-utils';

interface InitialConsultationCardProps {
    consultation: InitialConsultation;
    isExpanded: boolean;
    onToggle: () => void;
}

export function InitialConsultationCard({
    consultation,
    isExpanded,
    onToggle,
}: InitialConsultationCardProps) {
    const academicScores = parseJsonRecord(consultation.academic_scores);
    const checklist = parseJsonArray(consultation.checklist);

    return (
        <Card className="overflow-hidden">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/50"
            >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <PhoneCall className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{formatKoreanDate(consultation.preferred_date)}</span>
                    {consultation.preferred_time && (
                        <span className="text-sm text-muted-foreground">{consultation.preferred_time.slice(0, 5)}</span>
                    )}
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        신규상담
                    </Badge>
                    <Badge variant="outline" className={getInitialStatusClassName(consultation.status)}>
                        {INITIAL_STATUS_LABELS[consultation.status] || consultation.status}
                    </Badge>
                </div>
                {isExpanded ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
            </button>

            {isExpanded && (
                <CardContent className="border-t border-border pt-4 space-y-4">
                    <TextSection icon={<MessageSquare className="h-4 w-4 text-blue-600" />} title="문의 내용" text={consultation.inquiry_content} />
                    <TextSection icon={<FileText className="h-4 w-4 text-green-600" />} title="상담 메모" text={consultation.consultation_memo} />
                    <TextSection icon={<ClipboardList className="h-4 w-4 text-amber-600" />} title="관리자 메모" text={consultation.admin_notes} />
                    <TargetSchoolSection targetSchool={consultation.target_school} />
                    {academicScores && <InitialAcademicSection academicScores={academicScores} />}
                    {checklist && checklist.length > 0 && <ChecklistSection checklist={checklist} />}
                    <ApplicantSection consultation={consultation} />
                </CardContent>
            )}
        </Card>
    );
}

function getInitialStatusClassName(status: string): string {
    if (status === 'completed') return 'border-green-300 text-green-700';
    if (status === 'confirmed') return 'border-blue-300 text-blue-700';
    if (status === 'cancelled' || status === 'no_show') return 'border-red-300 text-red-700';
    return '';
}

function TextSection({ icon, title, text }: { icon: ReactNode; title: string; text: string | null }) {
    if (!text) return null;

    return (
        <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                {icon}
                {title}
            </div>
            <p className="pl-6 text-sm text-muted-foreground whitespace-pre-wrap">{text}</p>
        </section>
    );
}

function TargetSchoolSection({ targetSchool }: { targetSchool: string | null }) {
    if (!targetSchool) return null;

    return (
        <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Target className="h-4 w-4 text-purple-600" />
                목표 학교
            </div>
            <p className="pl-6 text-sm font-medium">{targetSchool}</p>
        </section>
    );
}

function InitialAcademicSection({ academicScores }: { academicScores: Record<string, unknown> }) {
    const mockTestGrades = isRecord(academicScores.mockTestGrades) ? academicScores.mockTestGrades : null;

    return (
        <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BookOpen className="h-4 w-4 text-indigo-600" />
                학업 성적
            </div>
            <div className="pl-6 space-y-2">
                <div className="flex flex-wrap gap-2">
                    {typeof academicScores.admissionType === 'string' && (
                        <Badge variant="outline">{getAdmissionTypeLabel(academicScores.admissionType)}</Badge>
                    )}
                    {academicScores.schoolGradeAvg !== null && academicScores.schoolGradeAvg !== undefined && (
                        <p className="text-sm">
                            <span className="text-muted-foreground">내신 평균:</span>{' '}
                            <span className="font-medium">{formatGradeValue(academicScores.schoolGradeAvg)}</span>
                        </p>
                    )}
                </div>
                {mockTestGrades && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {INITIAL_GRADE_SUBJECTS.map(({ key, label }) => {
                            if (mockTestGrades[key] === null || mockTestGrades[key] === undefined) return null;
                            return (
                                <div key={key} className="bg-muted rounded p-2 text-center text-sm">
                                    <div className="text-xs text-muted-foreground">{label}</div>
                                    <div className="font-medium">{formatGradeValue(mockTestGrades[key])}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}

function ChecklistSection({ checklist }: { checklist: unknown[] }) {
    return (
        <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ClipboardList className="h-4 w-4 text-teal-600" />
                체크리스트
            </div>
            <div className="pl-6">
                <ul className="text-sm text-muted-foreground space-y-1">
                    {checklist.map((item, index) => {
                        const label = getChecklistLabel(item);
                        const inputValue = getChecklistInputValue(item);
                        return (
                            <li key={`${label}-${index}`} className="flex items-center gap-2">
                                <span>{isChecklistChecked(item) ? '✅' : '⬜'}</span>
                                <span>
                                    {label}
                                    {inputValue && <span className="ml-1 text-foreground font-medium">({inputValue})</span>}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}

function ApplicantSection({ consultation }: { consultation: InitialConsultation }) {
    if (!consultation.student_name && !consultation.student_grade) return null;

    return (
        <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <PhoneCall className="h-4 w-4 text-gray-600" />
                신청자 정보
            </div>
            <div className="pl-6 space-y-1">
                {consultation.student_name && (
                    <p className="text-sm">
                        <span className="text-muted-foreground">이름:</span>{' '}
                        <span className="font-medium">{consultation.student_name}</span>
                    </p>
                )}
                {consultation.student_grade && (
                    <p className="text-sm">
                        <span className="text-muted-foreground">학년:</span>{' '}
                        <span className="font-medium">{consultation.student_grade}</span>
                    </p>
                )}
            </div>
        </section>
    );
}

function getAdmissionTypeLabel(admissionType: string): string {
    if (admissionType === 'early') return '수시';
    if (admissionType === 'regular') return '정시';
    return admissionType;
}

function formatGradeValue(value: unknown): string {
    if (value === -1) return '미응시';
    return `${formatUnknownValue(value)}등급`;
}

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Calendar,
    ChevronDown,
    ChevronUp,
    Eye,
    FileText,
    GraduationCap,
    Sparkles,
    Target,
} from 'lucide-react';
import type { StudentConsultation } from './student-consultation-types';
import {
    CONSULTATION_TYPE_LABELS,
    MOCK_SCORE_SUBJECTS,
    formatKoreanDate,
    formatUnknownValue,
    getMonthLabel,
    hasAnyValue,
    isRecord,
    parseJsonRecord,
} from './student-consultation-utils';

interface StudentConsultationCardProps {
    consultation: StudentConsultation;
    isExpanded: boolean;
    onToggle: () => void;
    onViewDetail: () => void;
}

export function StudentConsultationCard({
    consultation,
    isExpanded,
    onToggle,
    onViewDetail,
}: StudentConsultationCardProps) {
    const mockTestScores = parseJsonRecord(consultation.mock_test_scores);
    const physicalRecords = parseJsonRecord(consultation.physical_records);

    return (
        <Card className="overflow-hidden">
            <div className="flex items-stretch justify-between hover:bg-muted/50 transition-colors">
                <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{formatKoreanDate(consultation.consultation_date)}</span>
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                            {CONSULTATION_TYPE_LABELS[consultation.consultation_type] || consultation.consultation_type}
                        </Badge>
                        {consultation.admission_type && (
                            <Badge variant="outline">
                                {consultation.admission_type === 'early' ? '수시' : '정시'}
                            </Badge>
                        )}
                    </div>
                </button>
                <div className="flex shrink-0 items-center gap-2 px-4">
                    <button
                        type="button"
                        onClick={onViewDetail}
                        aria-label="상담 기록 상세 및 PDF 저장"
                        className="rounded-md p-1.5 text-primary transition-colors hover:bg-primary/10"
                        title="상세보기 / PDF 저장"
                    >
                        <Eye className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={onToggle} className="rounded-md p-1 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <CardContent className="border-t border-border pt-4 space-y-4">
                    <StudentAcademicSection consultation={consultation} mockTestScores={mockTestScores} />
                    <StudentPhysicalSection consultation={consultation} physicalRecords={physicalRecords} />
                    <StudentTargetSection consultation={consultation} />
                    {consultation.general_memo && (
                        <section className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <FileText className="h-4 w-4 text-green-600" />
                                종합 메모
                            </div>
                            <p className="pl-6 text-sm text-muted-foreground whitespace-pre-wrap">
                                {consultation.general_memo}
                            </p>
                        </section>
                    )}
                </CardContent>
            )}
        </Card>
    );
}

function StudentAcademicSection({
    consultation,
    mockTestScores,
}: {
    consultation: StudentConsultation;
    mockTestScores: Record<string, unknown> | null;
}) {
    if (!consultation.school_grade_avg && !mockTestScores && !consultation.academic_memo) return null;

    return (
        <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <GraduationCap className="h-4 w-4 text-blue-600" />
                학업
            </div>
            <div className="pl-6 space-y-2">
                {consultation.school_grade_avg && (
                    <p className="text-sm">
                        <span className="text-muted-foreground">내신 평균:</span>{' '}
                        <span className="font-medium">{consultation.school_grade_avg}등급</span>
                    </p>
                )}
                {mockTestScores && <MockScoreGrid mockTestScores={mockTestScores} />}
                {consultation.academic_memo && (
                    <p className="text-sm text-muted-foreground">{consultation.academic_memo}</p>
                )}
            </div>
        </section>
    );
}

function MockScoreGrid({ mockTestScores }: { mockTestScores: Record<string, unknown> }) {
    return (
        <div className="text-sm">
            <span className="text-muted-foreground">모의고사:</span>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {Object.entries(mockTestScores).map(([month, scores]) => {
                    const scoreRecord = isRecord(scores) ? scores : null;
                    if (!scoreRecord || !hasAnyValue(scoreRecord)) return null;

                    return (
                        <div key={month} className="bg-muted rounded p-2 text-xs">
                            <div className="font-medium mb-1">{getMonthLabel(month)}</div>
                            <div className="grid grid-cols-5 gap-1 text-center">
                                {MOCK_SCORE_SUBJECTS.map((subject) => (
                                    <div key={subject.key}>
                                        <div className="text-muted-foreground text-[10px]">{subject.shortLabel}</div>
                                        <div>{formatUnknownValue(scoreRecord[subject.key])}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function StudentPhysicalSection({
    consultation,
    physicalRecords,
}: {
    consultation: StudentConsultation;
    physicalRecords: Record<string, unknown> | null;
}) {
    if (!physicalRecords || Object.keys(physicalRecords).length === 0) return null;

    return (
        <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-orange-600" />
                실기 ({consultation.physical_record_type === 'latest' ? '최근 기록' : '평균 기록'})
            </div>
            <div className="pl-6">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Object.entries(physicalRecords).map(([name, rawRecord]) => {
                        const record = isRecord(rawRecord) ? rawRecord : {};
                        const value = formatUnknownValue(record.value);
                        const unit = record.unit ? String(record.unit) : '';
                        return (
                            <div key={name} className="bg-muted rounded p-2 text-center text-sm">
                                <div className="text-xs text-muted-foreground">{name}</div>
                                <div className="font-medium">
                                    {value}{unit && ` ${unit}`}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {consultation.physical_memo && (
                    <p className="text-sm text-muted-foreground mt-2">{consultation.physical_memo}</p>
                )}
            </div>
        </section>
    );
}

function StudentTargetSection({ consultation }: { consultation: StudentConsultation }) {
    if (!consultation.target_university_1 && !consultation.target_university_2 && !consultation.target_memo) {
        return null;
    }

    return (
        <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Target className="h-4 w-4 text-purple-600" />
                목표
            </div>
            <div className="pl-6 space-y-1">
                {consultation.target_university_1 && (
                    <p className="text-sm">
                        <span className="text-muted-foreground">목표 1:</span>{' '}
                        <span className="font-medium">{consultation.target_university_1}</span>
                    </p>
                )}
                {consultation.target_university_2 && (
                    <p className="text-sm">
                        <span className="text-muted-foreground">목표 2:</span>{' '}
                        <span className="font-medium">{consultation.target_university_2}</span>
                    </p>
                )}
                {consultation.target_memo && (
                    <p className="text-sm text-muted-foreground">{consultation.target_memo}</p>
                )}
            </div>
        </section>
    );
}

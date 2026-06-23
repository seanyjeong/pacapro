'use client';

import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar, CheckSquare, Clock, Dumbbell, Edit3, Link2, MessageSquare,
  Sparkles, UserRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import Link from 'next/link';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import { CONSULTATION_TYPE_LABELS, CONSULTATION_STATUS_LABELS, CONSULTATION_STATUS_COLORS } from '@/lib/types/consultation';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultation: Consultation | null;
  onEditInfo: (c: Consultation) => void;
  onStatusChange: () => void;
  onTrialRegister: () => void;
}

function StatusBadge({ status }: { status: ConsultationStatus }) {
  return (
    <Badge className={CONSULTATION_STATUS_COLORS[status]}>
      {CONSULTATION_STATUS_LABELS[status]}
    </Badge>
  );
}

function AcademicScoresSection({ scores }: { scores: Consultation['academicScores'] }) {
  if (!scores) return null;
  const hasMockGrades = scores.mockTestGrades &&
    Object.values(scores.mockTestGrades).some(v => v !== null && v !== undefined && v !== -1);
  const hasSchoolGradeAvg = scores.schoolGradeAvg !== null && scores.schoolGradeAvg !== undefined && scores.schoolGradeAvg !== -1;
  const hasAdmissionType = scores.admissionType;
  if (!hasMockGrades && !hasSchoolGradeAvg && !hasAdmissionType) return null;

  const admissionTypeLabel = scores.admissionType === 'early' ? '수시' :
    scores.admissionType === 'regular' ? '정시' : scores.admissionType;
  const gradeDisplay = (value: number | undefined | null) => {
    if (value === null || value === undefined) return '-';
    if (value === -1) return '미응시';
    return String(value) + '등급';
  };

  return (
    <div>
      <h4 className="font-medium text-foreground mb-3">성적 정보</h4>
      <div className="bg-muted rounded-lg p-4 space-y-4">
        <div className="flex gap-6">
          {hasSchoolGradeAvg && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">내신 평균</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">{gradeDisplay(scores.schoolGradeAvg)}</span>
            </div>
          )}
          {hasAdmissionType && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">입시 유형</span>
              <span className="font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{admissionTypeLabel}</span>
            </div>
          )}
        </div>
        {hasMockGrades && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">모의고사 등급</p>
            <div className="grid grid-cols-4 gap-2">
              {(['korean', 'math', 'english', 'exploration'] as const).map((subject) => {
                const labels = { korean: '국어', math: '수학', english: '영어', exploration: '탐구' };
                const value = scores.mockTestGrades?.[subject];
                return (
                  <div key={subject} className="bg-card rounded-lg p-3 text-center border border-border">
                    <div className="text-xs text-muted-foreground mb-1">{labels[subject]}</div>
                    <div className={`font-bold text-lg ${value === -1 ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {value === -1 ? '-' : value ?? '-'}
                    </div>
                    {value !== -1 && value !== null && value !== undefined && (
                      <div className="text-xs text-muted-foreground">등급</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DetailModal({ open, onOpenChange, consultation, onEditInfo, onStatusChange, onTrialRegister }: Props) {
  if (!consultation) return null;
  const c = consultation;
  const canRegisterTrial = c.consultation_type === 'new_registration' && !c.linked_student_id;
  const linkedStudentHref = c.linked_student_id ? `/students/${c.linked_student_id}` : null;

  const handleEditInfo = () => {
    onEditInfo(c);
    onOpenChange(false);
  };

  const handleStatusChange = () => {
    onStatusChange();
    onOpenChange(false);
  };

  const handleTrialRegister = () => {
    onTrialRegister();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>상담 신청 상세</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-6 py-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={c.status} />
            <Badge variant="outline">{CONSULTATION_TYPE_LABELS[c.consultation_type]}</Badge>
            {c.linked_student_name && !c.linked_student_is_trial && (
              <Badge variant="secondary" className="gap-1">
                <Link2 className="h-3 w-3" />기존 학생: {c.linked_student_name}
              </Badge>
            )}
          </div>

          <section className="rounded-md border border-border bg-muted/30 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-1">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CheckSquare className="h-4 w-4" />
                  다음 작업
                </h4>
                <p className="text-xs text-muted-foreground">
                  상담 진행, 일정 변경, 학생 전환을 여기서 바로 처리합니다.
                </p>
              </div>
              <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto">
                <Link href={`/consultations/${c.id}/conduct`}>
                  <Button className="w-full justify-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    상담 진행
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-center gap-2" onClick={handleStatusChange}>
                  <Calendar className="h-4 w-4" />
                  상태/일정 변경
                </Button>
                <Button variant="outline" className="w-full justify-center gap-2" onClick={handleEditInfo}>
                  <Edit3 className="h-4 w-4" />
                  정보 수정
                </Button>
                {linkedStudentHref ? (
                  <Link href={linkedStudentHref}>
                    <Button variant="outline" className="w-full justify-center gap-2">
                      <UserRound className="h-4 w-4" />
                      학생 상세
                    </Button>
                  </Link>
                ) : null}
                {canRegisterTrial ? (
                  <Button variant="outline" className="w-full justify-center gap-2" onClick={handleTrialRegister}>
                    <Dumbbell className="h-4 w-4" />
                    체험 등록
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">상담 일정</h4>
            <div className="flex items-center gap-4 text-blue-800 dark:text-blue-200">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(parseISO(c.preferred_date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {c.preferred_time.substring(0, 5)}
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-2">학생 정보</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <p className="text-foreground"><span className="text-muted-foreground">이름:</span> {c.student_name}</p>
              <p className="text-foreground"><span className="text-muted-foreground">연락처:</span> {c.student_phone || c.parent_phone}</p>
              <p className="text-foreground"><span className="text-muted-foreground">학년:</span> {c.student_grade}</p>
              <p className="text-foreground"><span className="text-muted-foreground">성별:</span> {c.gender === 'male' ? '남' : c.gender === 'female' ? '여' : '-'}</p>
              {c.student_school && (
                <p className="text-foreground"><span className="text-muted-foreground">학교:</span> {c.student_school}</p>
              )}
            </div>
          </div>

          <AcademicScoresSection scores={c.academicScores} />

          <div className="space-y-2 text-sm">
            {c.target_school && (
              <p className="text-foreground"><span className="text-muted-foreground">목표 학교:</span> {c.target_school}</p>
            )}
            {c.referrer_student && (
              <p className="text-foreground"><span className="text-muted-foreground">추천 원생:</span> {c.referrer_student}</p>
            )}
            {c.referralSources && c.referralSources.length > 0 && (
              <p className="text-foreground"><span className="text-muted-foreground">알게 된 경로:</span> {c.referralSources.join(', ')}</p>
            )}
          </div>

          {c.inquiry_content && (
            <div>
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />문의 내용
              </h4>
              <p className="text-sm bg-muted rounded p-3 whitespace-pre-wrap text-foreground">{c.inquiry_content}</p>
            </div>
          )}

          {c.admin_notes && (
            <div>
              <h4 className="font-medium text-foreground mb-2">관리자 메모</h4>
              <p className="text-sm bg-yellow-50 dark:bg-yellow-950 rounded p-3 whitespace-pre-wrap text-foreground">{c.admin_notes}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            신청일: {format(parseISO(c.created_at), 'yyyy-MM-dd HH:mm')}
          </p>

          {c.linked_student_id && c.linked_student_is_trial && (
            <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                체험 학생으로 등록 완료
                {c.linked_student_name && <Badge variant="secondary">{c.linked_student_name}</Badge>}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, CheckSquare, Clock, GraduationCap, Link2, MessageSquare, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Consultation } from '@/lib/types/consultation';
import {
  CONSULTATION_TYPE_LABELS,
  LEARNING_TYPE_LABELS,
} from '@/lib/types/consultation';
import { ConsultationCalendarStatusBadge } from './consultation-calendar-status-badge';

interface ConsultationCalendarDetailDialogProps {
  open: boolean;
  consultation: Consultation | null;
  onOpenChange: (open: boolean) => void;
  onBackToList: () => void;
}

function gradeDisplay(value: number | undefined | null) {
  if (value === null || value === undefined) return '-';
  if (value === -1) return '미응시';
  return `${value}등급`;
}

export function ConsultationCalendarDetailDialog({
  open,
  consultation,
  onOpenChange,
  onBackToList,
}: ConsultationCalendarDetailDialogProps) {
  const scores = consultation?.academicScores;
  const hasMockGrades = Boolean(scores?.mockTestGrades && Object.values(scores.mockTestGrades).some((value) => (
    value !== null && value !== undefined && value !== -1
  )));
  const hasSchoolGradeAvg = scores?.schoolGradeAvg !== null &&
    scores?.schoolGradeAvg !== undefined &&
    scores?.schoolGradeAvg !== -1;
  const hasAdmissionType = Boolean(scores?.admissionType);
  const admissionTypeLabel = scores?.admissionType === 'early'
    ? '수시'
    : scores?.admissionType === 'regular'
      ? '정시'
      : scores?.admissionType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>상담 신청 상세</DialogTitle>
        </DialogHeader>
        {consultation && (
          <div className="space-y-6 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <ConsultationCalendarStatusBadge status={consultation.status} />
              <Badge variant="outline" className={consultation.consultation_type === 'learning' ? 'border-emerald-300 text-emerald-700' : ''}>
                {CONSULTATION_TYPE_LABELS[consultation.consultation_type]}
              </Badge>
              {consultation.consultation_type === 'learning' && consultation.learning_type && (
                <Badge className="bg-emerald-100 text-emerald-800">
                  {LEARNING_TYPE_LABELS[consultation.learning_type]}
                </Badge>
              )}
              {consultation.linked_student_name && !consultation.linked_student_is_trial && (
                <Badge variant="secondary" className="gap-1">
                  <Link2 className="h-3 w-3" />
                  기존 학생: {consultation.linked_student_name}
                </Badge>
              )}
            </div>

            <div className="rounded-lg bg-blue-50 p-4">
              <h4 className="mb-2 font-medium text-blue-900">상담 일정</h4>
              <div className="flex flex-wrap items-center gap-4 text-blue-800">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4" />
                  {format(parseISO(consultation.preferred_date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {consultation.preferred_time.substring(0, 5)}
                </span>
              </div>
            </div>

            <div>
              <h4 className="mb-2 font-medium">학생 정보</h4>
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <p><span className="text-gray-500">이름:</span> {consultation.student_name}</p>
                <p><span className="text-gray-500">연락처:</span> {consultation.student_phone || consultation.parent_phone}</p>
                <p><span className="text-gray-500">학년:</span> {consultation.student_grade}</p>
                {consultation.student_school && <p><span className="text-gray-500">학교:</span> {consultation.student_school}</p>}
              </div>
            </div>

            {(hasMockGrades || hasSchoolGradeAvg || hasAdmissionType) && scores && (
              <div>
                <h4 className="mb-3 flex items-center gap-2 font-medium">
                  <GraduationCap className="h-4 w-4" />
                  성적 정보
                </h4>
                <div className="space-y-4 rounded-lg bg-gray-50 p-4">
                  <div className="flex flex-wrap gap-6">
                    {hasSchoolGradeAvg && (
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">내신 평균</span>
                        <strong className="text-blue-600">{gradeDisplay(scores.schoolGradeAvg)}</strong>
                      </span>
                    )}
                    {hasAdmissionType && (
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">입시 유형</span>
                        <strong className="rounded bg-blue-100 px-2 py-0.5 text-blue-700">{admissionTypeLabel}</strong>
                      </span>
                    )}
                  </div>
                  {hasMockGrades && (
                    <div>
                      <p className="mb-2 text-sm text-gray-500">모의고사 등급</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {Object.entries({ korean: '국어', math: '수학', english: '영어', exploration: '탐구' }).map(([subject, label]) => {
                          const value = scores.mockTestGrades?.[subject as keyof typeof scores.mockTestGrades];
                          return (
                            <div key={subject} className="rounded-lg border bg-white p-3 text-center">
                              <div className="mb-1 text-xs text-gray-500">{label}</div>
                              <div className={`text-lg font-bold ${value === -1 ? 'text-gray-400' : 'text-gray-800'}`}>
                                {value === -1 ? '-' : value ?? '-'}
                              </div>
                              {value !== -1 && value !== null && value !== undefined && (
                                <div className="text-xs text-gray-400">등급</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2 text-sm">
              {consultation.target_school && <p><span className="text-gray-500">목표 학교:</span> {consultation.target_school}</p>}
              {consultation.referrer_student && <p><span className="text-gray-500">추천 원생:</span> {consultation.referrer_student}</p>}
              {consultation.referralSources && consultation.referralSources.length > 0 && (
                <p><span className="text-gray-500">알게 된 경로:</span> {consultation.referralSources.join(', ')}</p>
              )}
            </div>

            {consultation.inquiry_content && (
              <div>
                <h4 className="mb-2 flex items-center gap-1 font-medium">
                  <MessageSquare className="h-4 w-4" />
                  문의 내용
                </h4>
                <p className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">{consultation.inquiry_content}</p>
              </div>
            )}

            {consultation.admin_notes && (
              <div>
                <h4 className="mb-2 font-medium">관리자 메모</h4>
                <p className="whitespace-pre-wrap rounded bg-yellow-50 p-3 text-sm">{consultation.admin_notes}</p>
              </div>
            )}

            <p className="text-xs text-gray-400">
              신청일: {format(parseISO(consultation.created_at), 'yyyy-MM-dd HH:mm')}
            </p>

            <div className="mt-4 border-t pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="flex items-center gap-2 font-medium">
                  <CheckSquare className="h-4 w-4" />
                  상담 진행
                </h4>
                <Link href={`/consultations/${consultation.id}/conduct`}>
                  <Button size="sm" className="gap-2">상담 진행 페이지로 이동</Button>
                </Link>
              </div>
            </div>

            {consultation.linked_student_id && consultation.linked_student_is_trial && (
              <div className="rounded-lg bg-green-50 p-4">
                <p className="flex items-center gap-2 text-green-800">
                  <Sparkles className="h-4 w-4" />
                  체험 학생으로 등록 완료
                  {consultation.linked_student_name && <Badge variant="secondary">{consultation.linked_student_name}</Badge>}
                </p>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onBackToList}>목록으로</Button>
          <Button onClick={() => onOpenChange(false)}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

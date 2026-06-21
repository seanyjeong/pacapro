import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Award, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { Consultation } from '@/lib/types/consultation';
import {
  CONSULTATION_STATUS_COLORS,
  CONSULTATION_STATUS_LABELS,
  LEARNING_TYPE_LABELS,
} from '@/lib/types/consultation';
import { EXAM_TYPES } from './enrolled-consultations-constants';
import type { ScoreData } from './enrolled-consultations-types';

interface EnrolledConsultationDetailDialogProps {
  open: boolean;
  consultation: Consultation | null;
  showScores: boolean;
  selectedExam: string;
  loadingScores: boolean;
  studentScores: ScoreData | null;
  onOpenChange: (open: boolean) => void;
  onToggleScores: () => void;
  onExamChange: (exam: string) => void;
}

export function EnrolledConsultationDetailDialog({
  open,
  consultation,
  showScores,
  selectedExam,
  loadingScores,
  studentScores,
  onOpenChange,
  onToggleScores,
  onExamChange,
}: EnrolledConsultationDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg px-6 py-6">
        <DialogHeader>
          <DialogTitle>재원생 상담 상세</DialogTitle>
        </DialogHeader>
        {consultation && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">학생명</Label>
                <p className="font-medium">{consultation.student_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">학년</Label>
                <p className="font-medium">{consultation.student_grade}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">상담일시</Label>
                <p className="font-medium">
                  {format(parseISO(consultation.preferred_date), 'yyyy년 M월 d일', { locale: ko })}{' '}
                  {consultation.preferred_time?.slice(0, 5)}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">상태</Label>
                <Badge className={CONSULTATION_STATUS_COLORS[consultation.status]}>
                  {CONSULTATION_STATUS_LABELS[consultation.status]}
                </Badge>
              </div>
              {consultation.learning_type && (
                <div>
                  <Label className="text-muted-foreground">상담유형</Label>
                  <Badge variant="secondary">{LEARNING_TYPE_LABELS[consultation.learning_type]}</Badge>
                </div>
              )}
              {consultation.admin_notes && (
                <div className="col-span-2">
                  <Label className="text-muted-foreground">메모</Label>
                  <p className="whitespace-pre-wrap text-sm">{consultation.admin_notes}</p>
                </div>
              )}
            </div>

            {consultation.linked_student_id && (
              <div className="border-t pt-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md p-2 transition-colors hover:bg-muted"
                  onClick={onToggleScores}
                >
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">모의고사 성적 조회</span>
                  </div>
                  {showScores ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showScores && (
                  <div className="mt-3 space-y-3">
                    <div className="flex gap-2">
                      {EXAM_TYPES.map((exam) => (
                        <Button
                          key={exam}
                          variant={selectedExam === exam ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => onExamChange(exam)}
                        >
                          {exam}
                        </Button>
                      ))}
                    </div>

                    {loadingScores ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : studentScores ? (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: '국어', score: studentScores.국어?.등급, sub: studentScores.국어?.표준점수 && `${studentScores.국어.표준점수}점` },
                          { label: '수학', score: studentScores.수학?.등급, sub: studentScores.수학?.표준점수 && `${studentScores.수학.표준점수}점` },
                          { label: '영어', score: studentScores.영어?.등급 },
                          { label: '탐구1', score: studentScores.탐구1?.등급, sub: studentScores.탐구1?.선택과목 },
                          { label: '탐구2', score: studentScores.탐구2?.등급, sub: studentScores.탐구2?.선택과목 },
                          { label: '한국사', score: studentScores.한국사?.등급 },
                        ].map((item) => (
                          <div key={item.label} className="rounded bg-muted/50 p-2 text-center">
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className="text-lg font-bold">{item.score || '-'}</p>
                            <p className="truncate text-xs text-muted-foreground">{item.sub}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        정시엔진에서 매칭된 성적이 없습니다.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
              <Link href={`/consultations/${consultation.id}/conduct`}>
                <Button>상담 진행</Button>
              </Link>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

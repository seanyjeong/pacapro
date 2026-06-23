'use client';
// Phase 4 #3 (ADR-018) — 상담 상세 모달

import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, Clock, User, School, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import Link from 'next/link';
import type { Consultation } from '@/lib/types/consultation';
import {
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_STATUS_COLORS
} from '@/lib/types/consultation';

interface DetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultation: Consultation | null;
  onEditStudent: (c: Consultation) => void;
}

export function DetailModal({ open, onOpenChange, consultation, onEditStudent }: DetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl py-6 px-6 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            상담 상세정보
          </DialogTitle>
        </DialogHeader>
        {consultation && (
          <div className="space-y-6">
            {/* 상태 및 일정 */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Badge className={CONSULTATION_STATUS_COLORS[consultation.status]}>
                  {CONSULTATION_STATUS_LABELS[consultation.status]}
                </Badge>
                {consultation.status === 'completed' && consultation.matched_student_status && (
                  <>
                    {(consultation.matched_student_status === 'registered_with_trial' || consultation.matched_student_status === 'registered_direct') && (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">등록완료</Badge>
                    )}
                    {consultation.matched_student_status === 'trial_ongoing' && (
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">체험중</Badge>
                    )}
                    {(consultation.matched_student_status === 'trial_completed' || consultation.matched_student_status === 'no_trial') && (
                      <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">미등록</Badge>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {format(parseISO(consultation.preferred_date), 'yyyy.MM.dd (EEE)', { locale: ko })}
                <Clock className="h-4 w-4 ml-2" />
                {consultation.preferred_time?.slice(0, 5)}
              </div>
            </div>

            {/* 학생 정보 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  학생 정보
                </h4>
                <Button variant="outline" size="sm" onClick={() => onEditStudent(consultation)}>
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  수정
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 border rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">이름</Label>
                  <p className="font-medium">{consultation.student_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">학년</Label>
                  <p className="font-medium">{consultation.student_grade}</p>
                </div>
                {(consultation.parent_phone || consultation.student_phone) && (
                  <div>
                    <Label className="text-xs text-muted-foreground">연락처</Label>
                    <p className="font-medium">{consultation.parent_phone || consultation.student_phone}</p>
                  </div>
                )}
                {consultation.student_school && (
                  <div>
                    <Label className="text-xs text-muted-foreground">학교</Label>
                    <p className="font-medium">{consultation.student_school}</p>
                  </div>
                )}
                {consultation.gender && (
                  <div>
                    <Label className="text-xs text-muted-foreground">성별</Label>
                    <p className="font-medium">{consultation.gender === 'male' ? '남자' : '여자'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 성적 정보 */}
            {(consultation.academic_scores || consultation.academicScores) && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                  <School className="h-4 w-4" />
                  성적 정보
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 border rounded-lg">
                  {(() => {
                    const scores = consultation.academic_scores || consultation.academicScores;
                    const mockTest = scores?.mockTestGrades || scores?.mock_exam_grades;
                    return (
                      <>
                        {scores?.schoolGradeAvg !== undefined && scores.schoolGradeAvg !== null && (
                          <div>
                            <Label className="text-xs text-muted-foreground">내신평균</Label>
                            <p className="font-medium">{scores.schoolGradeAvg === -1 ? '미응시' : `${scores.schoolGradeAvg}등급`}</p>
                          </div>
                        )}
                        {mockTest?.korean != null && (
                          <div>
                            <Label className="text-xs text-muted-foreground">국어(모의)</Label>
                            <p className="font-medium">{mockTest.korean === -1 ? '미응시' : `${mockTest.korean}등급`}</p>
                          </div>
                        )}
                        {mockTest?.math != null && (
                          <div>
                            <Label className="text-xs text-muted-foreground">수학(모의)</Label>
                            <p className="font-medium">{mockTest.math === -1 ? '미응시' : `${mockTest.math}등급`}</p>
                          </div>
                        )}
                        {mockTest?.english != null && (
                          <div>
                            <Label className="text-xs text-muted-foreground">영어(모의)</Label>
                            <p className="font-medium">{mockTest.english === -1 ? '미응시' : `${mockTest.english}등급`}</p>
                          </div>
                        )}
                        {mockTest?.exploration != null && (
                          <div>
                            <Label className="text-xs text-muted-foreground">탐구(모의)</Label>
                            <p className="font-medium">{mockTest.exploration === -1 ? '미응시' : `${mockTest.exploration}등급`}</p>
                          </div>
                        )}
                        {scores?.admissionType && (
                          <div>
                            <Label className="text-xs text-muted-foreground">입시 유형</Label>
                            <p className="font-medium">{scores.admissionType === 'early' ? '수시' : '정시'}</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 상담 관련 정보 */}
            {(consultation.target_school || consultation.referrer_student || consultation.inquiry_content) && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">상담 정보</h4>
                <div className="space-y-3 p-3 border rounded-lg">
                  {consultation.target_school && (
                    <div>
                      <Label className="text-xs text-muted-foreground">목표 학교</Label>
                      <p className="font-medium">{consultation.target_school}</p>
                    </div>
                  )}
                  {consultation.referrer_student && (
                    <div>
                      <Label className="text-xs text-muted-foreground">추천인</Label>
                      <p className="font-medium">{consultation.referrer_student}</p>
                    </div>
                  )}
                  {((consultation.referral_sources || consultation.referralSources)?.length ?? 0) > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">유입 경로</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(consultation.referral_sources || consultation.referralSources)?.map((source, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{source}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {consultation.inquiry_content && (
                    <div>
                      <Label className="text-xs text-muted-foreground">문의 내용</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap bg-muted/50 p-2 rounded">{consultation.inquiry_content}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 메모 */}
            {(consultation.admin_notes || consultation.consultation_memo) && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">메모</h4>
                <div className="space-y-2 p-3 border rounded-lg">
                  {consultation.admin_notes && (
                    <div>
                      <Label className="text-xs text-muted-foreground">관리자 메모</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{consultation.admin_notes}</p>
                    </div>
                  )}
                  {consultation.consultation_memo && (
                    <div>
                      <Label className="text-xs text-muted-foreground">상담 메모</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{consultation.consultation_memo}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                닫기
              </Button>
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

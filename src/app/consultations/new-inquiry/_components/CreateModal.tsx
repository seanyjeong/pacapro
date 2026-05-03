'use client';
// Phase 4 #3 (ADR-018) — 신규상담 등록 모달

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import type { CreateForm } from '../_types';

interface CreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createForm: CreateForm;
  onFormChange: (form: CreateForm) => void;
  creating: boolean;
  bookedTimes: string[];
  loadingBookedTimes: boolean;
  generateTimeSlots: (date: string) => string[];
  onLoadBookedTimes: (date: string) => void;
  onSubmit: () => void;
}

export function CreateModal({
  open,
  onOpenChange,
  createForm,
  onFormChange,
  creating,
  bookedTimes,
  loadingBookedTimes,
  generateTimeSlots,
  onLoadBookedTimes,
  onSubmit,
}: CreateModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto py-6 px-6">
        <DialogHeader>
          <DialogTitle>신규상담 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 필수 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>학생명 *</Label>
              <Input
                value={createForm.studentName}
                onChange={(e) => onFormChange({ ...createForm, studentName: e.target.value })}
                className="mt-1"
                placeholder="학생 이름"
              />
            </div>
            <div>
              <Label>연락처</Label>
              <Input
                value={createForm.phone}
                onChange={(e) => onFormChange({ ...createForm, phone: e.target.value })}
                className="mt-1"
                placeholder="010-0000-0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>학년</Label>
              <Select value={createForm.grade} onValueChange={(v) => onFormChange({ ...createForm, grade: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {['중1', '중2', '중3', '고1', '고2', '고3', 'N수'].map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>성별</Label>
              <Select value={createForm.gender} onValueChange={(v) => onFormChange({ ...createForm, gender: v as 'male' | 'female' })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">남</SelectItem>
                  <SelectItem value="female">여</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>학교</Label>
              <Input
                value={createForm.studentSchool}
                onChange={(e) => onFormChange({ ...createForm, studentSchool: e.target.value })}
                className="mt-1"
                placeholder="OO고"
              />
            </div>
          </div>

          {/* 성적 정보 */}
          <div className="border-t pt-4">
            <Label className="text-sm font-medium">성적 정보 (선택)</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label className="text-xs text-muted-foreground">내신 평균</Label>
                <Select
                  value={createForm.schoolGradeAvg?.toString() || ''}
                  onValueChange={(v) => onFormChange({ ...createForm, schoolGradeAvg: v === 'none' ? -1 : v ? parseInt(v) : undefined })}
                >
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미응시</SelectItem>
                    {[1,2,3,4,5,6,7,8,9].map((g) => (
                      <SelectItem key={g} value={g.toString()}>{g}등급</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">입시 유형</Label>
                <Select
                  value={createForm.admissionType}
                  onValueChange={(v) => onFormChange({ ...createForm, admissionType: v as 'early' | 'regular' | 'both' })}
                >
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="early">수시</SelectItem>
                    <SelectItem value="regular">정시</SelectItem>
                    <SelectItem value="both">수시+정시</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 모의고사 등급 */}
            <div className="mt-3">
              <Label className="text-xs text-muted-foreground">모의고사 등급</Label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {(['korean', 'math', 'english', 'exploration'] as const).map((subject) => {
                  const labels = { korean: '국어', math: '수학', english: '영어', exploration: '탐구' };
                  return (
                    <div key={subject}>
                      <Label className="text-xs text-center block mb-1 text-muted-foreground">{labels[subject]}</Label>
                      <Select
                        value={createForm.mockTestGrades[subject]?.toString() || ''}
                        onValueChange={(v) => onFormChange({
                          ...createForm,
                          mockTestGrades: {
                            ...createForm.mockTestGrades,
                            [subject]: v === 'none' ? -1 : v ? parseInt(v) : undefined
                          }
                        })}
                      >
                        <SelectTrigger className="h-8"><SelectValue placeholder="-" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">미응시</SelectItem>
                          {[1,2,3,4,5,6,7,8,9].map((g) => (
                            <SelectItem key={g} value={g.toString()}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 추가 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">목표 학교</Label>
              <Input
                value={createForm.targetSchool}
                onChange={(e) => onFormChange({ ...createForm, targetSchool: e.target.value })}
                placeholder="목표 대학교"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">추천 재원생</Label>
              <Input
                value={createForm.referrerStudent}
                onChange={(e) => onFormChange({ ...createForm, referrerStudent: e.target.value })}
                placeholder="재원생 이름"
              />
            </div>
          </div>

          {/* 상담 일정 */}
          <div className="border-t pt-4">
            <Label className="text-sm font-medium">상담 일정 *</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label className="text-xs text-muted-foreground">날짜</Label>
                <Input
                  type="date"
                  value={createForm.preferredDate}
                  onChange={(e) => {
                    onFormChange({ ...createForm, preferredDate: e.target.value, preferredTime: '' });
                    if (e.target.value) onLoadBookedTimes(e.target.value);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">시간</Label>
                {loadingBookedTimes ? (
                  <div className="p-2 text-center text-sm text-muted-foreground">로딩 중...</div>
                ) : createForm.preferredDate ? (
                  <Select
                    value={createForm.preferredTime}
                    onValueChange={(v) => onFormChange({ ...createForm, preferredTime: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="시간 선택" /></SelectTrigger>
                    <SelectContent>
                      {generateTimeSlots(createForm.preferredDate).map((time) => {
                        const isBooked = bookedTimes.includes(time);
                        return (
                          <SelectItem key={time} value={time}>
                            {time} {isBooked && '(예약있음)'}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">날짜 먼저 선택</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label>메모</Label>
            <Textarea
              value={createForm.notes}
              onChange={(e) => onFormChange({ ...createForm, notes: e.target.value })}
              className="mt-1"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSubmit} disabled={creating}>
            {creating ? '등록 중...' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

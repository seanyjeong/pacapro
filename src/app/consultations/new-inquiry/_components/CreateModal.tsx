'use client';
// Phase 4 #3 (ADR-018) — 신규상담 등록 모달

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import Link from 'next/link';
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
  const timeSlots = createForm.preferredDate ? generateTimeSlots(createForm.preferredDate) : [];
  const hasNoTimeSlots = Boolean(createForm.preferredDate) && !loadingBookedTimes && timeSlots.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-md p-0">
        <DialogHeader className="px-5 py-4">
          <DialogTitle>신규상담 등록</DialogTitle>
          <p className="text-sm text-muted-foreground">학생 기본정보와 상담 일정을 한 번에 등록합니다.</p>
        </DialogHeader>
        <div className="space-y-5 px-5 py-5">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">필수 정보</h3>
              <p className="text-xs text-muted-foreground">상담 목록과 학생 등록 전환에 바로 쓰이는 정보입니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="학생명" required htmlFor="new-inquiry-student-name">
                <Input
                  id="new-inquiry-student-name"
                  value={createForm.studentName}
                  onChange={(e) => onFormChange({ ...createForm, studentName: e.target.value })}
                  placeholder="학생 이름"
                />
              </Field>
              <Field label="연락처" required htmlFor="new-inquiry-phone">
                <Input
                  id="new-inquiry-phone"
                  value={createForm.phone}
                  onChange={(e) => onFormChange({ ...createForm, phone: e.target.value })}
                  placeholder="010-0000-0000"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="학년" required htmlFor="new-inquiry-grade">
                <Select value={createForm.grade} onValueChange={(v) => onFormChange({ ...createForm, grade: v })}>
                  <SelectTrigger id="new-inquiry-grade"><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {['중1', '중2', '중3', '고1', '고2', '고3', 'N수'].map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="성별" htmlFor="new-inquiry-gender">
                <Select value={createForm.gender} onValueChange={(v) => onFormChange({ ...createForm, gender: v as 'male' | 'female' })}>
                  <SelectTrigger id="new-inquiry-gender"><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">남</SelectItem>
                    <SelectItem value="female">여</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="학교" htmlFor="new-inquiry-school">
                <Input
                  id="new-inquiry-school"
                  value={createForm.studentSchool}
                  onChange={(e) => onFormChange({ ...createForm, studentSchool: e.target.value })}
                  placeholder="OO고"
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">성적 정보</h3>
              <p className="text-xs text-muted-foreground">선택 입력입니다. 상담 자료로만 사용됩니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="내신 평균" htmlFor="new-inquiry-school-grade">
                <Select
                  value={createForm.schoolGradeAvg?.toString() || ''}
                  onValueChange={(v) => onFormChange({ ...createForm, schoolGradeAvg: v === 'none' ? -1 : v ? parseInt(v) : undefined })}
                >
                  <SelectTrigger id="new-inquiry-school-grade"><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미응시</SelectItem>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                      <SelectItem key={g} value={g.toString()}>{g}등급</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="입시 유형" htmlFor="new-inquiry-admission">
                <Select
                  value={createForm.admissionType}
                  onValueChange={(v) => onFormChange({ ...createForm, admissionType: v as 'early' | 'regular' | 'both' })}
                >
                  <SelectTrigger id="new-inquiry-admission"><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="early">수시</SelectItem>
                    <SelectItem value="regular">정시</SelectItem>
                    <SelectItem value="both">수시+정시</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">모의고사 등급</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['korean', 'math', 'english', 'exploration'] as const).map((subject) => {
                  const labels = { korean: '국어', math: '수학', english: '영어', exploration: '탐구' };
                  const id = `new-inquiry-mock-${subject}`;
                  return (
                    <Field key={subject} label={labels[subject]} htmlFor={id} compact>
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
                        <SelectTrigger id={id} className="h-9"><SelectValue placeholder="-" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">미응시</SelectItem>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                            <SelectItem key={g} value={g.toString()}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <Field label="목표 학교" htmlFor="new-inquiry-target-school">
              <Input
                id="new-inquiry-target-school"
                value={createForm.targetSchool}
                onChange={(e) => onFormChange({ ...createForm, targetSchool: e.target.value })}
                placeholder="목표 대학교"
              />
            </Field>
            <Field label="추천 재원생" htmlFor="new-inquiry-referrer">
              <Input
                id="new-inquiry-referrer"
                value={createForm.referrerStudent}
                onChange={(e) => onFormChange({ ...createForm, referrerStudent: e.target.value })}
                placeholder="재원생 이름"
              />
            </Field>
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">상담 일정</h3>
              <p className="text-xs text-muted-foreground">지점 상담 설정의 요일별 운영시간을 기준으로 선택지가 표시됩니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="상담 날짜" required htmlFor="new-inquiry-date">
                <Input
                  id="new-inquiry-date"
                  type="date"
                  value={createForm.preferredDate}
                  onChange={(e) => {
                    onFormChange({ ...createForm, preferredDate: e.target.value, preferredTime: '' });
                    if (e.target.value) onLoadBookedTimes(e.target.value);
                  }}
                />
              </Field>
              <Field label="상담 시간" required htmlFor="new-inquiry-time">
                {loadingBookedTimes ? (
                  <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">시간을 불러오는 중입니다.</div>
                ) : hasNoTimeSlots ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <p className="font-medium">상담 가능 시간이 설정되지 않았습니다.</p>
                    <Link className="mt-1 inline-flex text-xs font-semibold underline" href="/consultations/settings">
                      상담 설정으로 이동
                    </Link>
                  </div>
                ) : createForm.preferredDate ? (
                  <Select
                    value={createForm.preferredTime}
                    onValueChange={(v) => onFormChange({ ...createForm, preferredTime: v })}
                  >
                    <SelectTrigger id="new-inquiry-time"><SelectValue placeholder="시간 선택" /></SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => {
                        const isBooked = bookedTimes.includes(time);
                        return (
                          <SelectItem key={time} value={time} disabled={isBooked}>
                            {time} {isBooked && '(예약있음)'}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">날짜를 먼저 선택해주세요.</p>
                )}
              </Field>
            </div>
          </section>

          <Field label="메모" htmlFor="new-inquiry-notes">
            <Textarea
              id="new-inquiry-notes"
              value={createForm.notes}
              onChange={(e) => onFormChange({ ...createForm, notes: e.target.value })}
              rows={2}
            />
          </Field>
        </div>
        <DialogFooter className="px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSubmit} disabled={creating}>
            {creating ? '등록 중...' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  children,
  compact = false,
  htmlFor,
  label,
  required = false,
}: {
  children: ReactNode;
  compact?: boolean;
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <Label className={compact ? 'text-xs text-muted-foreground' : undefined} htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-1 text-rose-600">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

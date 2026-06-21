import type { Ref } from 'react';
import { Award, Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { LearningType } from '@/lib/types/consultation';
import {
  CREATE_SCORE_EXAMS,
  EMPTY_SCORE_VALUE,
  SCORE_SUBJECTS,
} from './enrolled-consultations-constants';
import type { CreateConsultationForm, ScoreData, Student } from './enrolled-consultations-types';
import { filterStudents } from './enrolled-consultations-utils';

interface EnrolledConsultationCreateDialogProps {
  open: boolean;
  students: Student[];
  loadingStudents: boolean;
  studentSearch: string;
  studentDropdownOpen: boolean;
  studentDropdownRef: Ref<HTMLDivElement>;
  createForm: CreateConsultationForm;
  creating: boolean;
  bookedTimes: string[];
  loadingBookedTimes: boolean;
  createScoresLoading: boolean;
  createScores: Record<string, ScoreData | null>;
  onOpenChange: (open: boolean) => void;
  onStudentSearchChange: (value: string) => void;
  onStudentDropdownOpenChange: (open: boolean) => void;
  onSelectStudent: (student: Student) => void;
  onCreateFormChange: <K extends keyof CreateConsultationForm>(field: K, value: CreateConsultationForm[K]) => void;
  onPreferredDateChange: (date: string) => void;
  onScoreChange: (exam: string, subject: string, value: string) => void;
  onCreate: () => void;
  onCancel: () => void;
  generateTimeSlots: (date: string) => string[];
}

export function EnrolledConsultationCreateDialog({
  open,
  students,
  loadingStudents,
  studentSearch,
  studentDropdownOpen,
  studentDropdownRef,
  createForm,
  creating,
  bookedTimes,
  loadingBookedTimes,
  createScoresLoading,
  createScores,
  onOpenChange,
  onStudentSearchChange,
  onStudentDropdownOpenChange,
  onSelectStudent,
  onCreateFormChange,
  onPreferredDateChange,
  onScoreChange,
  onCreate,
  onCancel,
  generateTimeSlots,
}: EnrolledConsultationCreateDialogProps) {
  const selectedStudentName = students.find((student) => student.id.toString() === createForm.studentId)?.name;
  const filteredStudents = filterStudents(students, studentSearch).slice(0, 50);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md px-6 py-6">
        <DialogHeader>
          <DialogTitle>재원생상담 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>학생 선택 *</Label>
            {loadingStudents ? (
              <div className="mt-1 p-2 text-sm text-muted-foreground">학생 목록 로딩 중...</div>
            ) : (
              <div className="relative mt-1" ref={studentDropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="학생 이름 검색..."
                    value={studentSearch}
                    onChange={(event) => {
                      onStudentSearchChange(event.target.value);
                      onStudentDropdownOpenChange(true);
                    }}
                    onFocus={() => onStudentDropdownOpenChange(true)}
                    className="pl-9"
                  />
                  {createForm.studentId && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      ✓ {selectedStudentName}
                    </span>
                  )}
                </div>
                {studentDropdownOpen && (
                  <div className="absolute z-[100] mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-lg">
                    {filteredStudents.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                          createForm.studentId === student.id.toString() ? 'bg-muted' : ''
                        }`}
                        onClick={() => onSelectStudent(student)}
                      >
                        <span>{student.name} <span className="text-muted-foreground">({student.grade || '-'})</span></span>
                        {createForm.studentId === student.id.toString() && <span className="text-primary">✓</span>}
                      </button>
                    ))}
                    {filteredStudents.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">검색 결과가 없습니다</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>상담일 *</Label>
              <Input
                type="date"
                value={createForm.preferredDate}
                onChange={(event) => onPreferredDateChange(event.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>시간 *</Label>
              <Select
                value={createForm.preferredTime}
                onValueChange={(value) => onCreateFormChange('preferredTime', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="시간" />
                </SelectTrigger>
                <SelectContent>
                  {loadingBookedTimes ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">로딩 중...</div>
                  ) : (
                    generateTimeSlots(createForm.preferredDate).map((time) => {
                      const isBooked = bookedTimes.includes(time);
                      return (
                        <SelectItem key={time} value={time}>
                          {time} {isBooked && '(예약있음)'}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>상담 유형</Label>
            <Select
              value={createForm.learningType}
              onValueChange={(value) => onCreateFormChange('learningType', value as LearningType)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="정기 상담" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">정기 상담</SelectItem>
                <SelectItem value="admission">진학 상담</SelectItem>
                <SelectItem value="parent">학부모 상담</SelectItem>
                <SelectItem value="counseling">고민 상담</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>메모</Label>
            <Textarea
              value={createForm.adminNotes}
              onChange={(event) => onCreateFormChange('adminNotes', event.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          {createForm.studentId && (
            <div className="border-t pt-4">
              <Label className="mb-3 flex items-center gap-2">
                <Award className="h-4 w-4 text-blue-600" />
                모의고사 등급
              </Label>
              {createScoresLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">성적 조회 중...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {CREATE_SCORE_EXAMS.map((exam) => {
                    const scoreData = createScores[exam];
                    return (
                      <div key={exam} className="rounded-md bg-muted/30 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-medium">{exam} 모평</p>
                          {scoreData && <Badge className="bg-green-100 text-xs text-green-800">정시엔진 연동</Badge>}
                        </div>
                        {scoreData ? (
                          <div className="grid grid-cols-5 gap-2">
                            {SCORE_SUBJECTS.map((subject) => (
                              <div key={subject} className="text-center">
                                <p className="text-xs text-muted-foreground">{subject}</p>
                                <p className="text-lg font-bold">{scoreData[subject]?.등급 || '-'}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-5 gap-2">
                            {SCORE_SUBJECTS.map((subject) => (
                              <div key={subject}>
                                <Label className="text-xs text-muted-foreground">{subject}</Label>
                                <Select
                                  value={createForm.scores[exam][subject] || EMPTY_SCORE_VALUE}
                                  onValueChange={(value) => (
                                    onScoreChange(exam, subject, value === EMPTY_SCORE_VALUE ? '' : value)
                                  )}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="-" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={EMPTY_SCORE_VALUE}>-</SelectItem>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((grade) => (
                                      <SelectItem key={grade} value={grade.toString()}>{grade}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>취소</Button>
          <Button onClick={onCreate} disabled={creating}>
            {creating ? '등록 중...' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

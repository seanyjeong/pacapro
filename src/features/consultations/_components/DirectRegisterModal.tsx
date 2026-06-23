// consultations/_components/DirectRegisterModal.tsx
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DirectForm } from '../_types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  directForm: DirectForm;
  setDirectForm: (f: DirectForm) => void;
  registering: boolean;
  bookedTimes: string[];
  loadingBookedTimes: boolean;
  timeOptions: string[];
  handleDateChange: (date: string) => void;
  handleDirectRegister: () => void;
}

export function DirectRegisterModal({
  open, onOpenChange,
  directForm, setDirectForm,
  registering, bookedTimes, loadingBookedTimes, timeOptions,
  handleDateChange, handleDirectRegister,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>상담 직접 등록</DialogTitle>
          <DialogDescription>
            전화 상담 등 직접 예약을 잡아줄 때 사용합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>학생명 *</Label>
              <Input
                value={directForm.studentName}
                onChange={(e) => setDirectForm({ ...directForm, studentName: e.target.value })}
                placeholder="학생 이름"
              />
            </div>
            <div>
              <Label>전화번호 *</Label>
              <Input
                value={directForm.phone}
                onChange={(e) => setDirectForm({ ...directForm, phone: e.target.value })}
                placeholder="010-1234-5678"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>학년 *</Label>
              <Select
                value={directForm.grade}
                onValueChange={(v) => setDirectForm({ ...directForm, grade: v })}
              >
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {['중1', '중2', '중3', '고1', '고2', '고3', 'N수'].map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>성별</Label>
              <Select
                value={directForm.gender}
                onValueChange={(v) => setDirectForm({ ...directForm, gender: v as 'male' | 'female' })}
              >
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">남</SelectItem>
                  <SelectItem value="female">여</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>학교</Label>
              <Input
                value={directForm.studentSchool}
                onChange={(e) => setDirectForm({ ...directForm, studentSchool: e.target.value })}
                placeholder="OO고"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium">성적 정보 (선택)</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label className="text-xs text-muted-foreground">내신 평균</Label>
                <Select
                  value={directForm.schoolGradeAvg?.toString() || ''}
                  onValueChange={(v) => setDirectForm({ ...directForm, schoolGradeAvg: v === 'none' ? -1 : v ? parseInt(v) : undefined })}
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
                  value={directForm.admissionType}
                  onValueChange={(v) => setDirectForm({ ...directForm, admissionType: v as 'early' | 'regular' | 'both' })}
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
            <div className="mt-3">
              <Label className="text-xs text-muted-foreground">모의고사 등급</Label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {(['korean', 'math', 'english', 'exploration'] as const).map((subject) => {
                  const labels = { korean: '국어', math: '수학', english: '영어', exploration: '탐구' };
                  return (
                    <div key={subject}>
                      <Label className="text-xs text-center block mb-1 text-muted-foreground">{labels[subject]}</Label>
                      <Select
                        value={directForm.mockTestGrades[subject]?.toString() || ''}
                        onValueChange={(v) => setDirectForm({
                          ...directForm,
                          mockTestGrades: { ...directForm.mockTestGrades, [subject]: v === 'none' ? -1 : v ? parseInt(v) : undefined }
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">목표 학교</Label>
              <Input value={directForm.targetSchool} onChange={(e) => setDirectForm({ ...directForm, targetSchool: e.target.value })} placeholder="목표 대학교" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">추천 재원생</Label>
              <Input value={directForm.referrerStudent} onChange={(e) => setDirectForm({ ...directForm, referrerStudent: e.target.value })} placeholder="재원생 이름" />
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium">상담 일정 *</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label className="text-xs text-muted-foreground">날짜</Label>
                <Input type="date" value={directForm.preferredDate} onChange={(e) => handleDateChange(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">시간</Label>
                {loadingBookedTimes ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : directForm.preferredDate ? (
                  timeOptions.length > 0 ? (
                    <Select value={directForm.preferredTime} onValueChange={(v) => setDirectForm({ ...directForm, preferredTime: v })}>
                      <SelectTrigger><SelectValue placeholder="시간 선택" /></SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((time) => {
                          const isBooked = bookedTimes.includes(time);
                          return <SelectItem key={time} value={time}>{time} {isBooked && '(예약있음)'}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-orange-600 py-2">휴무일</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground py-2">날짜 먼저 선택</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label>메모</Label>
            <Textarea value={directForm.notes} onChange={(e) => setDirectForm({ ...directForm, notes: e.target.value })} placeholder="메모 (선택)" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleDirectRegister} disabled={registering}>
            {registering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

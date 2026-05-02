// consultations/_components/EditInfoModal.tsx
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Consultation } from '@/lib/types/consultation';
import type { EditForm } from '../_types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  consultation: Consultation | null;
  editForm: EditForm;
  setEditForm: (f: EditForm) => void;
  savingInfo: boolean;
  handleSaveInfo: () => void;
  onClose: () => void;
}

export function EditInfoModal({
  open, onOpenChange, consultation,
  editForm, setEditForm,
  savingInfo, handleSaveInfo, onClose,
}: Props) {
  return (
    <Dialog
      key={`edit-info-${consultation?.id || 'new'}`}
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>상담 정보 수정</DialogTitle>
          <DialogDescription>
            {consultation?.student_name}님의 정보를 수정합니다.
          </DialogDescription>
        </DialogHeader>

        {consultation && (
          <div className="space-y-4 px-6 py-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>학생명</Label>
                <Input value={editForm.studentName} onChange={(e) => setEditForm({ ...editForm, studentName: e.target.value })} placeholder="학생 이름" />
              </div>
              <div>
                <Label>학년</Label>
                <Select
                  key={`grade-${consultation?.id}`}
                  value={editForm.studentGrade || consultation?.student_grade || ''}
                  onValueChange={(v) => setEditForm({ ...editForm, studentGrade: v })}
                >
                  <SelectTrigger>
                    <span className="truncate">{editForm.studentGrade || consultation?.student_grade || '선택'}</span>
                  </SelectTrigger>
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
                  key={`gender-${consultation?.id}`}
                  value={editForm.gender || consultation?.gender || ''}
                  onValueChange={(v) => setEditForm({ ...editForm, gender: v as 'male' | 'female' })}
                >
                  <SelectTrigger>
                    <span className="truncate">
                      {editForm.gender === 'male' ? '남' : editForm.gender === 'female' ? '여' :
                       consultation?.gender === 'male' ? '남' : consultation?.gender === 'female' ? '여' : '선택'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">남</SelectItem>
                    <SelectItem value="female">여</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>학교</Label>
                <Input value={editForm.studentSchool} onChange={(e) => setEditForm({ ...editForm, studentSchool: e.target.value })} placeholder="학교명" />
              </div>
              <div>
                <Label>전화번호</Label>
                <Input value={editForm.parentPhone} onChange={(e) => setEditForm({ ...editForm, parentPhone: e.target.value })} placeholder="010-0000-0000" />
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-sm font-medium">성적 정보</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">내신 평균</Label>
                  <Select
                    key={`schoolGrade-${consultation?.id}`}
                    value={editForm.schoolGradeAvg?.toString() || consultation?.academicScores?.schoolGradeAvg?.toString() || ''}
                    onValueChange={(v) => setEditForm({ ...editForm, schoolGradeAvg: v === 'none' ? -1 : v ? parseInt(v) : undefined })}
                  >
                    <SelectTrigger>
                      <span className="truncate">
                        {(() => {
                          const val = editForm.schoolGradeAvg ?? consultation?.academicScores?.schoolGradeAvg;
                          if (val === -1) return '미응시';
                          if (val !== undefined && val !== null) return `${val}등급`;
                          return '선택';
                        })()}
                      </span>
                    </SelectTrigger>
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
                    key={`admission-${consultation?.id}`}
                    value={editForm.admissionType || consultation?.academicScores?.admissionType || ''}
                    onValueChange={(v) => setEditForm({ ...editForm, admissionType: v as 'early' | 'regular' | 'both' })}
                  >
                    <SelectTrigger>
                      <span className="truncate">
                        {(() => {
                          const val = editForm.admissionType || consultation?.academicScores?.admissionType;
                          if (val === 'early') return '수시';
                          if (val === 'regular') return '정시';
                          if (val === 'both') return '수시+정시';
                          return '선택';
                        })()}
                      </span>
                    </SelectTrigger>
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
                    const mockValue = editForm.mockTestGrades[subject]?.toString() || consultation?.academicScores?.mockTestGrades?.[subject]?.toString() || '';
                    return (
                      <div key={subject}>
                        <Label className="text-xs text-center block mb-1 text-muted-foreground">{labels[subject]}</Label>
                        <Select
                          key={`mock-${subject}-${consultation?.id}`}
                          value={mockValue}
                          onValueChange={(v) => setEditForm({
                            ...editForm,
                            mockTestGrades: { ...editForm.mockTestGrades, [subject]: v === 'none' ? -1 : v ? parseInt(v) : undefined }
                          })}
                        >
                          <SelectTrigger className="h-8">
                            <span className="truncate">
                              {(() => {
                                const val = editForm.mockTestGrades[subject] ?? consultation?.academicScores?.mockTestGrades?.[subject];
                                if (val === -1) return '미';
                                if (val !== undefined && val !== null) return val.toString();
                                return '-';
                              })()}
                            </span>
                          </SelectTrigger>
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
                <Input value={editForm.targetSchool} onChange={(e) => setEditForm({ ...editForm, targetSchool: e.target.value })} placeholder="목표 대학교" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">추천 재원생</Label>
                <Input value={editForm.referrerStudent} onChange={(e) => setEditForm({ ...editForm, referrerStudent: e.target.value })} placeholder="재원생 이름" />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onClose(); }}>취소</Button>
          <Button onClick={handleSaveInfo} disabled={savingInfo}>
            {savingInfo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

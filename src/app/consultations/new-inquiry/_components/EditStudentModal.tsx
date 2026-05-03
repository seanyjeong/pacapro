'use client';
// Phase 4 #3 (ADR-018) — 학생 정보 수정 모달

import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import type { EditStudentForm } from '../_types';
import type { Consultation } from '@/lib/types/consultation';

interface EditStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedConsultation: Consultation | null;
  editStudentForm: EditStudentForm;
  onFormChange: (form: EditStudentForm) => void;
  onSave: () => void;
  updatingStudent: boolean;
}

export function EditStudentModal({
  open,
  onOpenChange,
  selectedConsultation,
  editStudentForm,
  onFormChange,
  onSave,
  updatingStudent,
}: EditStudentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md py-6 px-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            학생 정보 수정
          </DialogTitle>
          <DialogDescription>
            {selectedConsultation?.student_name}님의 정보를 수정합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>학년</Label>
            <Select
              value={editStudentForm.studentGrade}
              onValueChange={(v) => onFormChange({ ...editStudentForm, studentGrade: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="학년 선택" />
              </SelectTrigger>
              <SelectContent>
                {['중1', '중2', '중3', '고1', '고2', '고3', 'N수'].map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>연락처</Label>
            <Input
              value={editStudentForm.parentPhone}
              onChange={(e) => onFormChange({ ...editStudentForm, parentPhone: e.target.value })}
              className="mt-1"
              placeholder="010-0000-0000"
            />
          </div>
          <div>
            <Label>학교</Label>
            <Input
              value={editStudentForm.studentSchool}
              onChange={(e) => onFormChange({ ...editStudentForm, studentSchool: e.target.value })}
              className="mt-1"
              placeholder="OO고등학교"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSave} disabled={updatingStudent}>
            {updatingStudent ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

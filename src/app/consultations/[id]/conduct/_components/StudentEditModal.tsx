'use client';

import { Loader2, Save, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import type { StudentEditForm } from '../_types';

interface StudentEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentEditForm: StudentEditForm;
  setStudentEditForm: (form: StudentEditForm) => void;
  savingStudent: boolean;
  onSave: () => void;
}

export function StudentEditModal({
  open, onOpenChange, studentEditForm, setStudentEditForm, savingStudent, onSave
}: StudentEditModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md py-6 px-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary-600" />
            학생 정보 수정
          </DialogTitle>
          <DialogDescription>상담 학생의 기본 정보를 수정합니다.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>학생명</Label>
              <Input
                value={studentEditForm.student_name}
                onChange={(e) => setStudentEditForm({ ...studentEditForm, student_name: e.target.value })}
                placeholder="이름"
              />
            </div>
            <div className="space-y-2">
              <Label>학년</Label>
              <Select
                value={studentEditForm.student_grade}
                onValueChange={(v) => setStudentEditForm({ ...studentEditForm, student_grade: v })}
              >
                <SelectTrigger>
                  <span>{studentEditForm.student_grade || '학년 선택'}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="중1">중1</SelectItem>
                  <SelectItem value="중2">중2</SelectItem>
                  <SelectItem value="중3">중3</SelectItem>
                  <SelectItem value="고1">고1</SelectItem>
                  <SelectItem value="고2">고2</SelectItem>
                  <SelectItem value="고3">고3</SelectItem>
                  <SelectItem value="N수생">N수생</SelectItem>
                  <SelectItem value="대학생">대학생</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>성별</Label>
              <Select
                value={studentEditForm.gender}
                onValueChange={(v) => setStudentEditForm({ ...studentEditForm, gender: v as 'male' | 'female' })}
              >
                <SelectTrigger>
                  <span>
                    {studentEditForm.gender === 'male' ? '남' :
                     studentEditForm.gender === 'female' ? '여' : '성별 선택'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">남</SelectItem>
                  <SelectItem value="female">여</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>학교</Label>
              <Input
                value={studentEditForm.student_school}
                onChange={(e) => setStudentEditForm({ ...studentEditForm, student_school: e.target.value })}
                placeholder="학교명"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>연락처</Label>
            <Input
              value={studentEditForm.parent_phone}
              onChange={(e) => setStudentEditForm({ ...studentEditForm, parent_phone: e.target.value })}
              placeholder="010-0000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label>목표 대학</Label>
            <Input
              value={studentEditForm.target_school}
              onChange={(e) => setStudentEditForm({ ...studentEditForm, target_school: e.target.value })}
              placeholder="목표 대학"
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSave} disabled={savingStudent}>
            {savingStudent ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

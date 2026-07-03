'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentAvatar } from '@/components/students/student-avatar';
import { studentsAPI } from '@/lib/api/students';
import type { Student } from '@/lib/types/student';
import { prepareStudentPhotoPayload } from '@/lib/utils/student-photo-client';

interface StudentPhotoFieldProps {
  mode: 'create' | 'edit';
  pendingPhotoFile: File | null;
  student?: Student;
  onPendingPhotoFileChange: (file: File | null) => void;
  onPhotoChanged?: () => void;
}

export function StudentPhotoField({
  mode,
  pendingPhotoFile,
  student,
  onPendingPhotoFileChange,
  onPhotoChanged,
}: StudentPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoStudent, setPhotoStudent] = useState<Student | undefined>(student);
  const canUploadImmediately = mode === 'edit' && !!student?.id;

  useEffect(() => {
    setPhotoStudent(student);
  }, [student]);

  useEffect(() => {
    if (!pendingPhotoFile) {
      setPreviewUrl(null);
      return undefined;
    }
    const nextUrl = URL.createObjectURL(pendingPhotoFile);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [pendingPhotoFile]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    setError(null);
    if (!canUploadImmediately) {
      onPendingPhotoFileChange(file);
      return;
    }

    setBusy(true);
    try {
      const payload = await prepareStudentPhotoPayload(file);
      const response = await studentsAPI.uploadStudentPhoto(student.id, payload, { suppressErrorToast: true });
      setPhotoStudent({
        ...student,
        ...response.photo,
        profile_image_updated_at: new Date().toISOString(),
      });
      toast.success('학생 사진이 저장되었습니다.');
      onPhotoChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : '학생 사진을 저장하지 못했습니다.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (mode === 'create' || hasPendingPhoto || !student?.id) {
      onPendingPhotoFileChange(null);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await studentsAPI.deleteStudentPhoto(student.id, { suppressErrorToast: true });
      setPhotoStudent({
        ...student,
        profile_image_key: null,
        profile_image_updated_at: null,
        profile_image_url: null,
        profile_thumb_key: null,
      });
      toast.success('학생 사진이 삭제되었습니다.');
      onPhotoChanged?.();
    } catch {
      const message = '학생 사진을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const hasPendingPhoto = !!previewUrl;
  const displayStudent = photoStudent || makePendingStudent(pendingPhotoFile?.name || '학생');
  const hasStoredPhoto = !!photoStudent?.profile_thumb_key || !!photoStudent?.profile_image_url;

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader><CardTitle>학생 사진</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {hasPendingPhoto ? (
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="h-full w-full object-cover" src={previewUrl} />
            </div>
          ) : (
            <StudentAvatar forcePhoto={hasStoredPhoto} size="lg" student={displayStudent} />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {hasPendingPhoto ? pendingPhotoFile?.name : displayStudent.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP · 8MB 이하</p>
            {mode === 'create' && hasPendingPhoto ? (
              <p className="mt-1 text-xs text-muted-foreground">등록 저장 후 사진이 함께 반영됩니다.</p>
            ) : null}
            {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <input
            ref={inputRef}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            type="file"
            onChange={handleFileChange}
          />
          <Button className="gap-2" disabled={busy} type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {hasStoredPhoto || hasPendingPhoto ? '변경' : '등록'}
          </Button>
          {hasStoredPhoto || hasPendingPhoto ? (
            <Button className="gap-2" disabled={busy} type="button" variant="outline" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
              삭제
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function makePendingStudent(name: string): Student {
  return {
    id: 0,
    academy_id: 0,
    student_number: null,
    name,
    gender: null,
    student_type: 'exam',
    phone: null,
    parent_phone: null,
    school: null,
    grade: null,
    age: null,
    address: null,
    admission_type: 'regular',
    profile_image_url: null,
    class_days: [],
    weekly_count: 0,
    monthly_tuition: '0',
    discount_rate: '0',
    discount_reason: null,
    payment_due_day: null,
    final_monthly_tuition: null,
    is_season_registered: false,
    current_season_id: null,
    status: 'active',
    rest_start_date: null,
    rest_end_date: null,
    rest_reason: null,
    enrollment_date: null,
    withdrawal_date: null,
    notes: null,
    is_trial: null,
    trial_remaining: null,
    trial_dates: null,
    time_slot: null,
    memo: null,
    class_days_next: null,
    class_days_effective_from: null,
    consultation_date: null,
    created_at: '',
    updated_at: '',
    deleted_at: null,
  };
}

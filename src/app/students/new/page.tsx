'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { StudentForm } from '@/components/students/student-form';
import { StudentFormCancelDialog } from '@/features/student-form/student-form-cancel-dialog';
import { StudentFormPageHeader } from '@/features/student-form/student-form-page-header';
import { studentsAPI } from '@/lib/api/students';
import { seasonsApi } from '@/lib/api/seasons';
import type { StudentFormData, Student, StudentStatus } from '@/lib/types/student';
import { prepareStudentPhotoPayload } from '@/lib/utils/student-photo-client';

function NewStudentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTrial = searchParams.get('is_trial') === 'true';
  const [cancelOpen, setCancelOpen] = useState(false);

  // 미등록관리 또는 체험생에서 넘어온 경우 저장된 학생 정보로 초기값 설정
  const fromPendingId = searchParams.get('from_pending');
  const fromTrialId = searchParams.get('from_trial');
  const existingStudentId = fromPendingId || fromTrialId;
  const [initialData, setInitialData] = useState<Partial<Student>>();
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!existingStudentId) return;
    let cancelled = false;
    // 저장 시 폼 전체가 기존 학생을 덮어쓰므로, 캐시가 아닌 최신 저장값으로 폼을 채웁니다.
    studentsAPI.getStudent(parseInt(existingStudentId), { suppressErrorToast: true })
      .then(({ student }) => {
        if (cancelled) return;
        // 등록일·체험·상태 값은 정식 등록 폼의 기본값을 쓰고, 나머지 저장 정보는 그대로 유지합니다.
        setInitialData({
          ...student, enrollment_date: undefined, is_trial: undefined, trial_dates: undefined, status: undefined,
          rest_start_date: undefined, rest_end_date: undefined, rest_reason: undefined,
        });
      })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [existingStudentId]);

  const handleSubmit = async (data: StudentFormData, pendingPhotoFile?: File | null) => {
    try {
      let student: Student;
      let photoUploaded = false;

      // 미등록관리 또는 체험생에서 온 경우: 기존 학생 UPDATE (id 유지, 상담 기록 보존)
      if (existingStudentId) {
        const updateData = {
          ...data,
          status: 'active' as StudentStatus,
          is_trial: false,
        };
        const response = await studentsAPI.updateStudent(parseInt(existingStudentId), updateData, { suppressErrorToast: true });
        student = response.student;
      } else {
        // 신규 등록: 새 학생 생성
        const response = await studentsAPI.createStudent(data, { suppressErrorToast: true });
        student = response.student;
      }

      // 시즌 등록이 선택된 경우
      if (data.enroll_in_season && data.selected_season_id) {
        try {
          // 시즌 정보 가져오기
          const seasonDetail = await seasonsApi.getSeason(data.selected_season_id);
          const seasonFee = parseFloat(seasonDetail.season.default_season_fee) || 0;

          await seasonsApi.enrollStudent(data.selected_season_id, {
            student_id: student.id,
            season_fee: seasonFee,
            registration_date: data.enrollment_date || new Date().toISOString().split('T')[0],
          });

          toast.success(`${student.name} 학생이 등록되었습니다!`, {
            description: '시즌 등록도 완료되었습니다.'
          });
        } catch (seasonError) {
          console.warn('Season enrollment failed:', seasonError);
          toast.warning(`${student.name} 학생이 등록되었습니다.`, {
            description: '시즌 등록에 실패했습니다. 학생 상세 페이지에서 다시 시도해주세요.'
          });
        }
      } else {
        toast.success(`${student.name} 학생이 등록되었습니다!`);
      }

      if (pendingPhotoFile) {
        try {
          const payload = await prepareStudentPhotoPayload(pendingPhotoFile);
          await studentsAPI.uploadStudentPhoto(student.id, payload, { suppressErrorToast: true });
          photoUploaded = true;
        } catch (photoError) {
          console.warn('Student photo upload failed:', photoError);
          toast.warning('학생은 등록되었지만 사진 저장에 실패했습니다. 수정 화면에서 다시 등록해주세요.');
        }
      }

      if (photoUploaded) {
        toast.success('학생 사진이 저장되었습니다.');
      }

      // 학생 목록으로 이동
      router.push('/students');
    } catch (error: unknown) {
      console.warn('학생 등록 저장에 실패했습니다.');
      throw error; // StudentForm에서 에러 처리
    }
  };

  const handleCancel = () => {
    setCancelOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <StudentFormPageHeader
        description="학생 기본 정보, 수업 정보, 학원비 기준을 한 번에 저장합니다."
        eyebrow="Student Intake"
        title="학생 등록"
        onBack={handleCancel}
      />

      {/* Form */}
      {existingStudentId && !initialData ? (
        loadError ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            학생 정보를 불러오지 못했습니다. 학생 목록에서 다시 시도해주세요.
          </p>
        ) : (
          <div className="flex min-h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )
      ) : (
      <StudentForm
        mode="create"
        initialData={initialData as Student | undefined}
        initialIsTrial={isTrial}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
      )}
      <StudentFormCancelDialog
        mode="create"
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onLeave={() => router.push('/students')}
      />
    </div>
  );
}

// Suspense로 감싸서 export (useSearchParams 사용 위해)
export default function NewStudentPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <NewStudentContent />
    </Suspense>
  );
}

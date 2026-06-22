'use client';

import { useParams, useRouter } from 'next/navigation';
import { TabletStudentActions } from '@/features/tablet-student-detail/tablet-student-actions';
import { TabletStudentContactCard } from '@/features/tablet-student-detail/tablet-student-contact-card';
import { TabletStudentDetailError } from '@/features/tablet-student-detail/tablet-student-detail-error';
import { TabletStudentDetailHeader } from '@/features/tablet-student-detail/tablet-student-detail-header';
import { TabletStudentDetailLoading } from '@/features/tablet-student-detail/tablet-student-detail-loading';
import { TabletStudentMemoCard } from '@/features/tablet-student-detail/tablet-student-memo-card';
import { TabletStudentSummary } from '@/features/tablet-student-detail/tablet-student-summary';
import { useTabletStudentDetail } from '@/features/tablet-student-detail/use-tablet-student-detail';

export default function TabletStudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;
  const state = useTabletStudentDetail(studentId);

  if (state.loading) {
    return <TabletStudentDetailLoading />;
  }

  if (state.loadError) {
    return <TabletStudentDetailError onBack={() => router.back()} onRetry={() => void state.fetchStudentData()} />;
  }

  if (!state.student) {
    return <TabletStudentDetailError onBack={() => router.back()} onRetry={() => void state.fetchStudentData()} />;
  }

  return (
    <div className="space-y-4">
      <TabletStudentDetailHeader student={state.student} onBack={() => router.back()} />
      <TabletStudentActions student={state.student} />
      <TabletStudentSummary student={state.student} attendanceSummary={state.attendanceSummary} />
      <TabletStudentContactCard student={state.student} />
      <TabletStudentMemoCard memo={state.student.memo} />
    </div>
  );
}

import { AlertCircle, Loader2, Save, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  EditedInstructorAttendance,
  InstructorAttendanceStatus,
  InstructorOption,
} from './instructor-attendance-types';
import { InstructorAttendanceRow } from './instructor-attendance-row';

interface Props {
  editedAttendances: Map<number, EditedInstructorAttendance>;
  instructors: InstructorOption[];
  saveError: string | null;
  saving: boolean;
  onMarkAllPresent: () => void;
  onStatusChange: (instructorId: number, status: InstructorAttendanceStatus) => void;
  onSubmit: () => void;
  onTimeChange: (instructorId: number, field: 'checkInTime' | 'checkOutTime', value: string) => void;
}

export function InstructorAttendanceListCard({
  editedAttendances,
  instructors,
  saveError,
  saving,
  onMarkAllPresent,
  onStatusChange,
  onSubmit,
  onTimeChange,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>강사 출근 현황</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onMarkAllPresent}>
              전체 출근
            </Button>
            <Button onClick={onSubmit} disabled={saving || editedAttendances.size === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              저장
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {saveError && (
          <div
            className="mb-4 flex items-start gap-2 rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
            <span>{saveError}</span>
          </div>
        )}

        {instructors.length === 0 ? (
          <EmptyState icon={UserCheck} title="등록된 강사가 없어요." description="강사 관리에서 강사를 먼저 등록해 주세요." />
        ) : (
          <div className="space-y-2">
            {instructors.map((instructor) => (
              <InstructorAttendanceRow
                key={instructor.id}
                edited={editedAttendances.get(instructor.id)}
                instructor={instructor}
                onStatusChange={onStatusChange}
                onTimeChange={onTimeChange}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

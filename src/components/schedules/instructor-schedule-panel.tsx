'use client';

import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { InstructorScheduleFooter } from './instructor-schedule-footer';
import { InstructorScheduleHeader } from './instructor-schedule-header';
import { InstructorScheduleList } from './instructor-schedule-list';
import { InstructorScheduleSlotTabs } from './instructor-schedule-slot-tabs';
import {
  InstructorScheduleErrorState,
  InstructorScheduleLoadingState,
  InstructorScheduleNoDateState,
} from './instructor-schedule-states';
import { useInstructorSchedulePanel } from './use-instructor-schedule-panel';

interface InstructorSchedulePanelProps {
  date: string | null;
  onClose?: () => void;
  onRequestExtraDay?: () => void;
  onSave?: () => void;
}

export function InstructorSchedulePanel({
  date,
  onClose,
  onRequestExtraDay,
  onSave,
}: InstructorSchedulePanelProps) {
  const state = useInstructorSchedulePanel({ date, onSave });

  if (!date) {
    return <InstructorScheduleNoDateState />;
  }

  const dateObj = new Date(`${date}T00:00:00`);
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
  const formattedDate = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${dayOfWeek})`;

  return (
    <Card>
      <InstructorScheduleHeader formattedDate={formattedDate} onClose={onClose} />

      <CardContent className="space-y-4">
        {state.loading ? (
          <InstructorScheduleLoadingState />
        ) : state.loadError ? (
          <InstructorScheduleErrorState message={state.loadError} onRetry={state.loadSchedules} />
        ) : (
          <>
            <InstructorScheduleSlotTabs
              activeSlot={state.activeSlot}
              slotCounts={state.slotCounts}
              onSlotChange={state.setActiveSlot}
            />

            {state.saveError && (
              <div
                className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{state.saveError}</span>
              </div>
            )}

            <InstructorScheduleList
              activeSlot={state.activeSlot}
              activeSlotInfo={state.activeSlotInfo}
              instructors={state.instructors}
              selections={state.selections}
              onTimeChange={state.updateTime}
              onToggleInstructor={state.toggleInstructor}
            />

            <InstructorScheduleFooter
              saving={state.saving}
              selectedCount={state.selectedCount}
              totalSelectedCount={state.totalSelectedCount}
              onRequestExtraDay={onRequestExtraDay}
              onSave={state.handleSave}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

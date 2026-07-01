import { Calendar, List } from 'lucide-react';
import { InstructorSchedulePanel } from '@/components/schedules/instructor-schedule-panel';
import { ScheduleCalendarV2 } from '@/components/schedules/schedule-calendar-v2';
import { ScheduleList } from '@/components/schedules/schedule-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DailyInstructorStats } from '@/lib/api/schedules';
import type { Consultation } from '@/lib/types/consultation';
import type { ClassSchedule, TimeSlot } from '@/lib/types/schedule';
import { SelectedDateOperations } from './selected-date-operations';
import { SchedulesPanelToggle } from './schedules-panel-toggle';

interface SchedulesWorkspaceProps {
  consultations: Record<string, Consultation[]>;
  currentMonth: number;
  currentYear: number;
  instructorStats: Record<string, DailyInstructorStats>;
  isPanelExpanded: boolean;
  schedules: ClassSchedule[];
  selectedDate: string | null;
  onConsultationClick: (date: string) => void;
  onDateSelect: (date: string) => void;
  onDeleteSchedule: (scheduleId: number, scheduleName: string) => void;
  onEditSchedule: (scheduleId: number) => void;
  onMonthChange: (year: number, month: number) => void;
  onOpenExtraDay: () => void;
  onPanelSave: () => void;
  onScheduleClick: (scheduleId: number) => void;
  onSlotClick: (date: string, slot: TimeSlot) => void;
  onTogglePanel: () => void;
}

export function SchedulesWorkspace(props: SchedulesWorkspaceProps) {
  const collapsedPanelStats = props.selectedDate ? props.instructorStats[props.selectedDate] : undefined;
  const selectedScheduleCount = props.selectedDate
    ? props.schedules.filter((schedule) => schedule.class_date === props.selectedDate).length
    : 0;
  const deskGridClass = props.isPanelExpanded
    ? 'xl:grid-cols-[minmax(0,1fr)_320px]'
    : 'xl:grid-cols-[minmax(0,1fr)_48px]';

  const instructorPanel = props.isPanelExpanded ? (
    <>
      <SchedulesPanelToggle expanded onToggle={props.onTogglePanel} />
      <InstructorSchedulePanel
        date={props.selectedDate}
        onRequestExtraDay={props.onOpenExtraDay}
        onSave={props.onPanelSave}
      />
    </>
  ) : (
    <SchedulesPanelToggle
      expanded={false}
      instructorStats={collapsedPanelStats}
      scheduleCount={selectedScheduleCount}
      onToggle={props.onTogglePanel}
    />
  );

  return (
    <Tabs defaultValue="calendar" className="space-y-5">
      <TabsList className="grid w-full max-w-xs grid-cols-2 rounded-md border border-slate-200 bg-slate-50 p-1">
        <TabsTrigger value="calendar" className="flex items-center gap-2 rounded-sm">
          <Calendar className="h-4 w-4" />
          캘린더
        </TabsTrigger>
        <TabsTrigger value="list" className="flex items-center gap-2 rounded-sm">
          <List className="h-4 w-4" />
          목록
        </TabsTrigger>
      </TabsList>

      <TabsContent value="calendar" className="space-y-4">
        <SelectedDateOperations
          consultations={props.consultations}
          instructorStats={props.instructorStats}
          schedules={props.schedules}
          selectedDate={props.selectedDate}
          onConsultationClick={props.onConsultationClick}
          onSlotClick={props.onSlotClick}
        />

        <div className={`grid min-w-0 gap-4 ${deskGridClass}`}>
          <div className="min-w-0 xl:hidden">
            {props.isPanelExpanded ? (
              <div className="space-y-2">
                <SchedulesPanelToggle expanded mode="bar" onToggle={props.onTogglePanel} />
                <InstructorSchedulePanel
                  date={props.selectedDate}
                  onRequestExtraDay={props.onOpenExtraDay}
                  onSave={props.onPanelSave}
                />
              </div>
            ) : (
              <SchedulesPanelToggle
                expanded={false}
                instructorStats={collapsedPanelStats}
                mode="bar"
                scheduleCount={selectedScheduleCount}
                onToggle={props.onTogglePanel}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <ScheduleCalendarV2
              consultations={props.consultations}
              currentMonth={props.currentMonth}
              currentYear={props.currentYear}
              instructorStats={props.instructorStats}
              schedules={props.schedules}
              selectedDate={props.selectedDate}
              onConsultationClick={props.onConsultationClick}
              onDateSelect={props.onDateSelect}
              onMonthChange={props.onMonthChange}
              onSlotClick={props.onSlotClick}
            />
          </div>
          <div className={`hidden flex-col transition-all duration-200 xl:flex ${props.isPanelExpanded ? 'w-80' : 'w-12'}`}>
            {instructorPanel}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="list">
        <ScheduleList
          emptyMessage="수업이 없습니다."
          schedules={props.schedules}
          onDelete={(schedule) => props.onDeleteSchedule(schedule.id, schedule.title || `${schedule.instructor_name} 수업`)}
          onEdit={(schedule) => props.onEditSchedule(schedule.id)}
          onScheduleClick={(schedule) => props.onScheduleClick(schedule.id)}
        />
      </TabsContent>
    </Tabs>
  );
}

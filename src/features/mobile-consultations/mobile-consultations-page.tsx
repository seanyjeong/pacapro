'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isOwner } from '@/lib/utils/permissions';
import { MobileLoading, MobileScreen } from '../mobile-home/mobile-screen';
import { MobileConsultationCreateSheet } from './mobile-consultation-create-sheet';
import { MobileConsultationDetailSheet } from './mobile-consultation-detail-sheet';
import { MobileConsultationsCalendar } from './mobile-consultations-calendar';
import { MobileConsultationsHeader } from './mobile-consultations-header';
import { MobileConsultationsList } from './mobile-consultations-list';
import { useMobileConsultationsState } from './use-mobile-consultations-state';

export function MobileConsultationsPage() {
  const state = useMobileConsultationsState();

  if (state.hasPermission === null) {
    return <MobileLoading />;
  }

  const canCreate = isOwner();

  return (
    <MobileScreen
      testId="mobile-consultations-workspace"
      title="오늘 상담"
      description={state.selectedDateLabel}
      actions={(
        <MobileConsultationsHeader
          showCalendar={state.showCalendar}
          loading={state.loading}
          onRefresh={state.loadConsultations}
          onToggleCalendar={() => {
            state.setCalendarMonth({ year: state.selectedDate.getFullYear(), month: state.selectedDate.getMonth() });
            state.setShowCalendar(!state.showCalendar);
          }}
        />
      )}
      footer={canCreate ? (
        <Button type="button" size="lg" className="w-full" onClick={state.openCreateForm} aria-label="신규 상담 등록">
          <Plus className="h-5 w-5" />
          신규 상담 등록
        </Button>
      ) : undefined}
    >
      {state.showCalendar && (
        <MobileConsultationsCalendar
          calendarMonth={state.calendarMonth}
          monthCounts={state.monthCounts}
          selectedDate={state.selectedDate}
          today={state.today}
          onDateSelect={state.selectDate}
          onMonthMove={state.moveCalendarMonth}
        />
      )}

      <MobileConsultationsList
        consultations={state.consultations}
        loading={state.loading}
        error={state.listError}
        stats={state.stats}
        onOpen={state.setSelectedConsultation}
        onRetry={state.loadConsultations}
      />

      <MobileConsultationCreateSheet
        open={state.showCreateForm}
        bookedTimes={state.bookedTimes}
        creating={state.creating}
        form={state.createForm}
        onChange={state.updateCreateForm}
        onClose={state.closeCreateForm}
        onDateChange={state.changeCreateDate}
        onSubmit={state.createConsultation}
      />

      <MobileConsultationDetailSheet
        consultation={state.selectedConsultation}
        showStatusChange={state.showStatusChange}
        updatingStatus={state.updatingStatus}
        onClose={() => {
          state.setSelectedConsultation(null);
          state.setShowStatusChange(false);
        }}
        onStatusChange={state.changeStatus}
        onToggleStatusChange={() => state.setShowStatusChange(!state.showStatusChange)}
      />
    </MobileScreen>
  );
}

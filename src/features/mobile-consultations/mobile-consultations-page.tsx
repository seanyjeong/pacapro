'use client';

import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isOwner } from '@/lib/utils/permissions';
import { MobileIconButton, MobileLoading, MobileScreen } from '../mobile-home/mobile-screen';
import { MobileConsultationCreateSheet } from './mobile-consultation-create-sheet';
import { MobileConsultationDetailSheet } from './mobile-consultation-detail-sheet';
import { MobileConsultationsCalendar } from './mobile-consultations-calendar';
import { MobileConsultationsTitle } from './mobile-consultations-header';
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
      title={(
        <MobileConsultationsTitle
          showCalendar={state.showCalendar}
          onToggleCalendar={() => {
            state.setCalendarMonth({ year: state.selectedDate.getFullYear(), month: state.selectedDate.getMonth() });
            state.setShowCalendar(!state.showCalendar);
          }}
        />
      )}
      description={state.selectedDateLabel}
      actions={(
        <MobileIconButton label="상담 목록 새로고침" onClick={state.loadConsultations} disabled={state.loading}>
          <RefreshCw className={`h-5 w-5 ${state.loading ? 'animate-spin' : ''}`} />
        </MobileIconButton>
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

'use client';

import { isOwner } from '@/lib/utils/permissions';
import { MobileConsultationCreateSheet } from './mobile-consultation-create-sheet';
import { MobileConsultationDetailSheet } from './mobile-consultation-detail-sheet';
import { MobileConsultationsCalendar } from './mobile-consultations-calendar';
import { MobileConsultationsHeader } from './mobile-consultations-header';
import { MobileConsultationsList } from './mobile-consultations-list';
import { useMobileConsultationsState } from './use-mobile-consultations-state';

export function MobileConsultationsPage() {
  const state = useMobileConsultationsState();

  if (state.hasPermission === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">로딩 중...</div>
      </div>
    );
  }

  const canCreate = isOwner();

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50" data-testid="mobile-consultations-workspace">
      <MobileConsultationsHeader
        selectedDateLabel={state.selectedDateLabel}
        showCalendar={state.showCalendar}
        loading={state.loading}
        onBack={() => state.router.push('/m')}
        onRefresh={state.loadConsultations}
        onToggleCalendar={() => {
          state.setCalendarMonth({ year: state.selectedDate.getFullYear(), month: state.selectedDate.getMonth() });
          state.setShowCalendar(!state.showCalendar);
        }}
      />

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

      <main className="mx-auto w-full max-w-md px-4 py-4 pb-24">
        <MobileConsultationsList
          consultations={state.consultations}
          loading={state.loading}
          error={state.listError}
          stats={state.stats}
          onOpen={state.setSelectedConsultation}
          onRetry={state.loadConsultations}
        />
      </main>

      {canCreate && (
        <button
          type="button"
          onClick={state.openCreateForm}
          className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-950 text-white shadow-lg transition active:scale-95 dark:bg-zinc-50 dark:text-zinc-950"
          aria-label="신규 상담 등록"
        >
          <span className="text-2xl leading-none">+</span>
        </button>
      )}

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
    </div>
  );
}

'use client';

import { AlertCircle } from 'lucide-react';
import { ConsultationCalendarDayListDialog } from './consultation-calendar-day-list-dialog';
import { ConsultationCalendarDetailDialog } from './consultation-calendar-detail-dialog';
import { ConsultationCalendarHeader } from './consultation-calendar-header';
import { ConsultationCalendarLearningDialog } from './consultation-calendar-learning-dialog';
import { ConsultationCalendarMonthCard } from './consultation-calendar-month-card';
import { ConsultationCalendarWorkQueue } from './consultation-calendar-work-queue';
import { useConsultationCalendarState } from './use-consultation-calendar-state';

export function ConsultationCalendarContent() {
  const state = useConsultationCalendarState();
  const newInquiryCount = state.consultations.filter((item) => item.consultation_type === 'new_registration').length;
  const learningCount = state.consultations.filter((item) => item.consultation_type === 'learning').length;
  const pendingCount = state.consultations.filter((item) => item.status === 'pending').length;
  const confirmedCount = state.consultations.filter((item) => item.status === 'confirmed').length;

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl" data-testid="consultation-calendar-operations-workspace">
        <ConsultationCalendarHeader
          fromSchedule={state.fromSchedule}
          memoCount={state.studentMemos.length}
          onBack={state.handleBack}
          totalCount={state.consultations.length}
        />
        {state.loadError ? (
          <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold">상담 달력 정보를 불러오지 못했습니다</h2>
                <p className="mt-1 text-sm">{state.loadError}</p>
              </div>
            </div>
          </section>
        ) : null}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <ConsultationCalendarMonthCard
            currentMonth={state.currentMonth}
            loading={state.loading}
            calendarDays={state.calendarDays}
            startPadding={state.startPadding}
            onPreviousMonth={state.previousMonth}
            onNextMonth={state.nextMonth}
            getConsultationsForDate={state.getConsultationsForDate}
            getMemosForDate={state.getMemosForDate}
            onDateClick={state.handleDateClick}
            onCreateLearning={state.openLearningModal}
          />
          <ConsultationCalendarWorkQueue
            confirmedCount={confirmedCount}
            learningCount={learningCount}
            memoCount={state.studentMemos.length}
            newInquiryCount={newInquiryCount}
            onCreateLearningToday={() => state.openLearningModal(new Date())}
            pendingCount={pendingCount}
            totalCount={state.consultations.length}
          />
        </div>
      </div>
      <ConsultationCalendarDayListDialog
        open={state.dayListModalOpen}
        selectedDate={state.selectedDate}
        consultations={state.selectedConsultations}
        onOpenChange={state.setDayListModalOpen}
        onOpenDetail={state.openDetailModal}
      />
      <ConsultationCalendarDetailDialog
        open={state.detailModalOpen}
        consultation={state.selectedConsultation}
        onOpenChange={state.setDetailModalOpen}
        onBackToList={state.reopenDayList}
      />
      <ConsultationCalendarLearningDialog
        open={state.learningModalOpen}
        date={state.learningModalDate}
        students={state.students}
        studentsLoading={state.studentsLoading}
        form={state.learningForm}
        submitting={state.submitting}
        onOpenChange={state.setLearningModalOpen}
        onFormChange={state.updateLearningForm}
        onLearningTypeChange={state.setLearningType}
        onSubmit={state.handleLearningSubmit}
      />
    </main>
  );
}

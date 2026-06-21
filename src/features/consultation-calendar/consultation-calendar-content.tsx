'use client';

import { ConsultationCalendarDayListDialog } from './consultation-calendar-day-list-dialog';
import { ConsultationCalendarDetailDialog } from './consultation-calendar-detail-dialog';
import { ConsultationCalendarHeader } from './consultation-calendar-header';
import { ConsultationCalendarLearningDialog } from './consultation-calendar-learning-dialog';
import { ConsultationCalendarMonthCard } from './consultation-calendar-month-card';
import { useConsultationCalendarState } from './use-consultation-calendar-state';

export function ConsultationCalendarContent() {
  const state = useConsultationCalendarState();

  return (
    <div className="space-y-6">
      <ConsultationCalendarHeader
        fromSchedule={state.fromSchedule}
        onBack={state.handleBack}
      />
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
    </div>
  );
}

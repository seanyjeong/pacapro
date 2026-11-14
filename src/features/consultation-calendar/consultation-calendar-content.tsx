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
    <div className="space-y-4" data-testid="consultation-calendar-operations-workspace">
      <ConsultationCalendarHeader
        fromSchedule={state.fromSchedule}
        onBack={state.handleBack}
        onCreateLearningToday={() => state.openLearningModal(new Date())}
      />
      {state.loadError ? (
        <section className="flex items-start gap-3 rounded-2xl bg-warning-soft p-4 text-warning">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold">상담 달력 정보를 불러오지 못했어요</h2>
            <p className="mt-1 text-sm">{state.loadError}</p>
          </div>
        </section>
      ) : null}
      <ConsultationCalendarWorkQueue
        confirmedCount={confirmedCount}
        learningCount={learningCount}
        memoCount={state.studentMemos.length}
        newInquiryCount={newInquiryCount}
        pendingCount={pendingCount}
        totalCount={state.consultations.length}
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
        memos={state.selectedMemos}
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

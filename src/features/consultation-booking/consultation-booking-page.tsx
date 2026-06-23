'use client';

import { useParams, useRouter } from 'next/navigation';
import { BookingConfirmStep } from './booking-confirm-step';
import { BookingError } from './booking-error';
import { BookingHeader } from './booking-header';
import { BookingInfoStep } from './booking-info-step';
import { BookingLoading } from './booking-loading';
import { BookingScheduleStep } from './booking-schedule-step';
import { BookingStepper } from './booking-stepper';
import { BOOKING_PAGE_ERROR } from './booking-constants';
import { useConsultationBookingState } from './use-consultation-booking-state';

export function ConsultationBookingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const state = useConsultationBookingState(slug, () => router.push(`/c/${slug}/success`));

  if (state.loading) return <BookingLoading />;
  if (state.loadError || !state.pageInfo) {
    return <BookingError message={state.loadError ?? BOOKING_PAGE_ERROR} onRetry={state.reloadPageInfo} />;
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 py-5 md:max-w-5xl" data-testid="consultation-booking-workspace">
      <BookingHeader pageInfo={state.pageInfo} />
      <BookingStepper step={state.step} />

      {state.step === 1 && (
        <BookingInfoStep
          error={state.formError}
          formData={state.formData}
          onChange={state.updateForm}
          onMockGradeChange={state.updateMockGrade}
          onNext={state.goToSchedule}
          referralSources={state.pageInfo.settings.referralSources || []}
        />
      )}

      {state.step === 2 && (
        <BookingScheduleStep
          currentMonth={state.currentMonth}
          onBack={() => state.setStep(1)}
          onMonthChange={state.setCurrentMonth}
          onNext={state.goToConfirm}
          onSelectDate={state.selectDate}
          onSelectTime={state.setSelectedTime}
          pageInfo={state.pageInfo}
          selectedDate={state.selectedDate}
          selectedTime={state.selectedTime}
          slots={state.slots}
          slotsError={state.slotsError}
          slotsLoading={state.slotsLoading}
        />
      )}

      {state.step === 3 && state.selectedDate && (
        <BookingConfirmStep
          error={state.submitError}
          formData={state.formData}
          onBack={() => state.setStep(2)}
          onSubmit={state.submit}
          selectedDate={state.selectedDate}
          selectedTime={state.selectedTime}
          submitting={state.submitting}
        />
      )}
    </main>
  );
}

import { useState } from 'react';
import type { SeasonFormData, TimeSlot } from '@/lib/types/season';
import { createSeasonFromForm } from './season-create-api';
import { createInitialSeasonForm, SEASON_CREATE_SAVE_ERROR, validateSeasonCreateForm } from './season-create-utils';

export function useSeasonCreateState(onCreated: () => void) {
  const [currentYear] = useState(() => new Date().getFullYear());
  const [formData, setFormData] = useState<SeasonFormData>(() => createInitialSeasonForm(currentYear));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeField = (field: keyof SeasonFormData, value: unknown) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const toggleOperatingDay = (day: number) => {
    setFormData((previous) => ({
      ...previous,
      operating_days: previous.operating_days.includes(day)
        ? previous.operating_days.filter((value) => value !== day)
        : [...previous.operating_days, day].sort((a, b) => a - b),
    }));
  };

  const toggleTimeSlot = (grade: string, timeSlot: TimeSlot) => {
    setFormData((previous) => {
      const currentSlots = previous.grade_time_slots?.[grade] || [];
      const nextSlots = currentSlots.includes(timeSlot)
        ? currentSlots.filter((slot) => slot !== timeSlot)
        : [...currentSlots, timeSlot];
      return {
        ...previous,
        grade_time_slots: {
          ...previous.grade_time_slots,
          [grade]: nextSlots,
        },
      };
    });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateSeasonCreateForm(formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createSeasonFromForm(formData);
      onCreated();
    } catch {
      setError(SEASON_CREATE_SAVE_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    changeField,
    currentYear,
    error,
    formData,
    submit,
    submitting,
    toggleOperatingDay,
    toggleTimeSlot,
  };
}

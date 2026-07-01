import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SEASON_MONTHLY_POLICY } from '@/lib/season-monthly-policy';
import type { SeasonFormData, TimeSlot } from '@/lib/types/season';
import { fetchSeasonForEdit, updateSeasonFromForm } from './season-edit-api';
import { mapSeasonToEditForm, SEASON_EDIT_LOAD_ERROR, SEASON_EDIT_SAVE_ERROR, validateSeasonEditForm } from './season-edit-utils';

const initialFormData: SeasonFormData = {
  continuous_discount_rate: 0,
  continuous_discount_type: 'none',
  end_date: '',
  grade_time_slots: {},
  non_season_end_date: '',
  operating_days: [],
  season_fee: 0,
  season_monthly_policy: DEFAULT_SEASON_MONTHLY_POLICY,
  season_name: '',
  season_type: 'early',
  start_date: '',
  status: 'draft',
  year: new Date().getFullYear(),
};

export function useSeasonEditState(seasonId: number, onUpdated: () => void) {
  const [formData, setFormData] = useState<SeasonFormData>(initialFormData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!Number.isFinite(seasonId)) {
      setLoadError(SEASON_EDIT_LOAD_ERROR);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetchSeasonForEdit(seasonId);
      setFormData(mapSeasonToEditForm(response.season));
    } catch {
      setLoadError(SEASON_EDIT_LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    reload();
  }, [reload]);

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
    const validationError = validateSeasonEditForm(formData);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await updateSeasonFromForm(seasonId, formData);
      onUpdated();
    } catch {
      setSaveError(SEASON_EDIT_SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  };

  return {
    changeField,
    formData,
    loadError,
    loading,
    reload,
    saveError,
    saving,
    submit,
    toggleOperatingDay,
    toggleTimeSlot,
  };
}

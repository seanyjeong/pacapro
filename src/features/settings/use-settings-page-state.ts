'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DEFAULT_ACADEMY_SETTINGS } from './settings-constants';
import {
  getAcademySettings,
  getCurrentUser,
  getOperationSettings,
  resetAllData,
  saveAcademySettings,
  saveOperationSettings,
} from './settings-api';
import { SETTINGS_RESET_COPY } from './settings-reset-copy';
import type {
  AcademySettings,
  ClassTimeKey,
  SettingsUser,
  TimeRangePart,
  TuitionKind,
  WeeklyTuitionKey,
} from './settings-types';
import {
  formatTimeRange,
  mergeOperationSettings,
  normalizeAcademySettings,
  parseTimeRange,
  serializeAcademySettings,
} from './settings-utils';

export function useSettingsPageState() {
  const [settings, setSettings] = useState<AcademySettings>(DEFAULT_ACADEMY_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<AcademySettings>(DEFAULT_ACADEMY_SETTINGS);
  const [user, setUser] = useState<SettingsUser | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      const [academyResult, operationResult] = await Promise.allSettled([
        getAcademySettings(),
        getOperationSettings(),
      ]);

      let nextSettings = DEFAULT_ACADEMY_SETTINGS;
      if (academyResult.status === 'fulfilled') {
        nextSettings = normalizeAcademySettings(academyResult.value.settings, nextSettings);
      } else {
        console.error('Academy settings load failed');
      }
      if (operationResult.status === 'fulfilled') {
        nextSettings = mergeOperationSettings(operationResult.value.settings, nextSettings);
      } else {
        console.error('Operation settings load failed');
      }
      setSettings(nextSettings);
      setSavedSettings(nextSettings);
    } catch {
      console.error('Settings user load failed');
      toast.error('설정 화면을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateSetting = <K extends keyof AcademySettings>(key: K, value: AcademySettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateClassTime = (key: ClassTimeKey, part: TimeRangePart, value: string) => {
    setSettings((prev) => {
      const range = parseTimeRange(prev[key]);
      const nextRange = { ...range, [part]: value };
      return { ...prev, [key]: formatTimeRange(nextRange.start, nextRange.end) };
    });
  };

  const updateTuition = (kind: TuitionKind, weeklyKey: WeeklyTuitionKey, value: number) => {
    setSettings((prev) => ({
      ...prev,
      [kind]: {
        ...prev[kind],
        [weeklyKey]: value,
      },
    }));
  };

  const hasUnsavedChanges = useMemo(
    () => serializeAcademySettings(settings) !== serializeAcademySettings(savedSettings),
    [savedSettings, settings]
  );

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await saveAcademySettings(settings);
      await saveOperationSettings(settings);
      setSavedSettings(settings);
      toast.success('학원 설정이 저장되었습니다.');
    } catch {
      console.error('Settings save failed');
      toast.error('설정을 저장하지 못했습니다. 입력값을 확인한 뒤 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAllData = () => {
    if (resetConfirmation !== SETTINGS_RESET_COPY.confirmation) return;
    setResetDialogOpen(true);
  };

  const confirmResetAllData = async () => {
    if (resetConfirmation !== SETTINGS_RESET_COPY.confirmation) return;
    setIsResetting(true);
    try {
      await resetAllData();
      toast.success(SETTINGS_RESET_COPY.success);
      setResetConfirmation('');
      setResetDialogOpen(false);
      window.location.reload();
    } catch {
      console.error('Settings reset failed');
      toast.error(SETTINGS_RESET_COPY.failure);
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetDialogOpenChange = (open: boolean) => {
    if (open || isResetting) return;
    setResetDialogOpen(false);
  };

  return {
    settings,
    user,
    isLoadingSettings,
    isSaving,
    resetConfirmation,
    resetDialogOpen,
    isResetting,
    hasUnsavedChanges,
    updateSetting,
    updateClassTime,
    updateTuition,
    saveSettings,
    setResetConfirmation,
    handleResetAllData,
    confirmResetAllData,
    handleResetDialogOpenChange,
  };
}

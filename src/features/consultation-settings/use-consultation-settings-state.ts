import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  addBlockedSlot,
  checkSlugAvailability,
  getConsultationSettings,
  removeBlockedSlot,
  updateConsultationSettings,
  updateWeeklyHours,
} from '@/lib/api/consultations';
import type { BlockedSlot, ChecklistTemplate, ConsultationSettings, WeeklyHour } from '@/lib/types/consultation';
import {
  DEFAULT_CHECKLIST_TEMPLATE,
  INITIAL_CHECKLIST_ITEM,
  INITIAL_CONSULTATION_SETTINGS,
  TIME_OPTIONS,
} from './consultation-settings-constants';
import type { ConsultationSettingsPatch, NewChecklistItemState } from './consultation-settings-types';
import { createDefaultWeeklyHours, getKoreanHolidays } from './consultation-settings-utils';

const SUPPRESS_API_ERROR_TOAST = { suppressErrorToast: true };

export function useConsultationSettingsState() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [academyName, setAcademyName] = useState('');
  const [slug, setSlug] = useState('');
  const [originalSlug, setOriginalSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [savingSlug, setSavingSlug] = useState(false);
  const [settings, setSettings] = useState<Partial<ConsultationSettings>>(INITIAL_CONSULTATION_SETTINGS);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHour[]>([]);
  const [hasSavedWeeklyHours, setHasSavedWeeklyHours] = useState(false);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [addingBlock, setAddingBlock] = useState(false);
  const [newReferralSource, setNewReferralSource] = useState('');
  const [checklistTemplate, setChecklistTemplate] = useState<ChecklistTemplate[]>(DEFAULT_CHECKLIST_TEMPLATE);
  const [newChecklistItem, setNewChecklistItem] = useState<NewChecklistItemState>(INITIAL_CHECKLIST_ITEM);
  const [addChecklistModalOpen, setAddChecklistModalOpen] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [copied, setCopied] = useState(false);
  const [defaultStartTime, setDefaultStartTime] = useState('09:00:00');
  const [defaultEndTime, setDefaultEndTime] = useState('18:00:00');
  const [addingHolidays, setAddingHolidays] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoadError(null);
      try {
        const response = await getConsultationSettings(SUPPRESS_API_ERROR_TOAST);
        const loadedSlug = response.academy?.slug || '';
        const loadedHours = response.weeklyHours || [];
        const savedTemplate = (response.settings as { checklist_template?: ChecklistTemplate[] })?.checklist_template;

        setAcademyName(response.academy?.name || '');
        setSlug(loadedSlug);
        setOriginalSlug(loadedSlug);
        setSettings(response.settings || {});
        setHasSavedWeeklyHours(loadedHours.length > 0);
        setWeeklyHours(loadedHours.length === 0 ? createDefaultWeeklyHours() : loadedHours);
        setBlockedSlots(response.blockedSlots || []);

        if (savedTemplate && savedTemplate.length > 0) {
          setChecklistTemplate(savedTemplate);
        }
      } catch {
        setLoadError('잠시 후 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const checklistCategories = useMemo(
    () => [...new Set(checklistTemplate.map((item) => item.category))],
    [checklistTemplate],
  );

  const setSlugValue = (value: string) => {
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    setSlugAvailable(null);
  };

  const updateSetting = <K extends keyof ConsultationSettings>(field: K, value: ConsultationSettings[K]) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const checkSlug = async () => {
    if (!slug || slug.length < 3) {
      toast.error('3자 이상 입력해주세요.');
      return;
    }

    setCheckingSlug(true);
    try {
      const result = await checkSlugAvailability(slug);
      setSlugAvailable(result.available);
      if (result.available) {
        toast.success('사용 가능한 주소입니다.');
      } else {
        toast.error('이미 사용 중인 주소입니다. 다른 주소를 입력해주세요.');
      }
    } catch {
      toast.error('페이지 주소 확인에 실패했습니다.');
    } finally {
      setCheckingSlug(false);
    }
  };

  const handleSaveSlug = async () => {
    if (!slug || slug.length < 3) {
      toast.error('페이지 주소를 3자 이상 입력해주세요.');
      return;
    }
    if (slugAvailable !== true) {
      toast.error('먼저 중복 확인을 해주세요.');
      return;
    }

    setSavingSlug(true);
    try {
      await updateConsultationSettings({ slug }, SUPPRESS_API_ERROR_TOAST);
      setOriginalSlug(slug);
      setSlugAvailable(null);
      toast.success('페이지 주소가 저장되었습니다.');
    } catch {
      toast.error('페이지 주소를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSavingSlug(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateConsultationSettings({ ...settings }, SUPPRESS_API_ERROR_TOAST);
      toast.success('설정이 저장되었습니다.');
    } catch {
      toast.error('설정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWeeklyHours = async () => {
    setSaving(true);
    try {
      await updateWeeklyHours(weeklyHours, SUPPRESS_API_ERROR_TOAST);
      setHasSavedWeeklyHours(true);
      toast.success('운영 시간이 저장되었습니다.');
    } catch {
      toast.error('운영 시간을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlockedSlot = async () => {
    if (!newBlockedDate) {
      toast.error('날짜를 선택해주세요.');
      return;
    }

    setAddingBlock(true);
    try {
      const result = await addBlockedSlot({
        blockedDate: newBlockedDate,
        isAllDay: true,
        reason: newBlockReason,
      }, SUPPRESS_API_ERROR_TOAST);

      setBlockedSlots((prev) => [
        ...prev,
        {
          id: result.id,
          blocked_date: newBlockedDate,
          is_all_day: true,
          reason: newBlockReason,
          created_at: new Date().toISOString(),
        },
      ]);
      setBlockModalOpen(false);
      setNewBlockedDate('');
      setNewBlockReason('');
      toast.success('날짜가 차단되었습니다.');
    } catch {
      toast.error('날짜를 차단하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setAddingBlock(false);
    }
  };

  const handleRemoveBlockedSlot = async (id: number) => {
    try {
      await removeBlockedSlot(id, SUPPRESS_API_ERROR_TOAST);
      setBlockedSlots((prev) => prev.filter((slot) => slot.id !== id));
      toast.success('차단이 해제되었습니다.');
    } catch {
      toast.error('차단을 해제하지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleAddAllHolidays = async () => {
    const today = new Date();
    const holidays = getKoreanHolidays(new Date().getFullYear());
    const futureHolidays = holidays.filter((holiday) => new Date(holiday.date) >= today);
    const existingDates = blockedSlots.map((slot) => slot.blocked_date.substring(0, 10));
    const newHolidays = futureHolidays.filter((holiday) => !existingDates.includes(holiday.date));

    if (futureHolidays.length === 0) {
      toast.error('추가할 공휴일이 없습니다.');
      return;
    }
    if (newHolidays.length === 0) {
      toast.info('모든 공휴일이 이미 차단되어 있습니다.');
      return;
    }

    setAddingHolidays(true);
    try {
      for (const holiday of newHolidays) {
        const result = await addBlockedSlot(
          { blockedDate: holiday.date, reason: holiday.name },
          SUPPRESS_API_ERROR_TOAST,
        );
        setBlockedSlots((prev) => [
          ...prev,
          {
            id: result.id,
            blocked_date: holiday.date,
            is_all_day: true,
            reason: holiday.name,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      toast.success(`${newHolidays.length}개 공휴일이 차단되었습니다.`);
    } catch {
      toast.error('공휴일을 추가하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setAddingHolidays(false);
    }
  };

  const updateHour = <K extends keyof WeeklyHour>(dayOfWeek: number, field: K, value: WeeklyHour[K]) => {
    setWeeklyHours((prev) => prev.map((hour) => (hour.dayOfWeek === dayOfWeek ? { ...hour, [field]: value } : hour)));
  };

  const applyDefaultTimeToAll = () => {
    setWeeklyHours((prev) => prev.map((hour) => ({
      ...hour,
      isAvailable: true,
      startTime: defaultStartTime,
      endTime: defaultEndTime,
    })));
    toast.success('모든 요일에 적용되었습니다.');
  };

  const applyDefaultTimeToWeekdays = () => {
    setWeeklyHours((prev) => prev.map((hour) => ({
      ...hour,
      isAvailable: hour.dayOfWeek >= 1 && hour.dayOfWeek <= 5,
      startTime: defaultStartTime,
      endTime: defaultEndTime,
    })));
    toast.success('평일(월~금)에 적용되었습니다.');
  };

  const addReferralSource = () => {
    const trimmed = newReferralSource.trim();
    if (!trimmed) return;
    if (settings.referralSources?.includes(trimmed)) {
      toast.error('이미 존재하는 항목입니다.');
      return;
    }

    setSettings((prev) => ({
      ...prev,
      referralSources: [...(prev.referralSources || []), trimmed],
    }));
    setNewReferralSource('');
  };

  const removeReferralSource = (source: string) => {
    setSettings((prev) => ({
      ...prev,
      referralSources: prev.referralSources?.filter((item) => item !== source),
    }));
  };

  const updateNewChecklistItem = <K extends keyof NewChecklistItemState>(field: K, value: NewChecklistItemState[K]) => {
    setNewChecklistItem((prev) => ({ ...prev, [field]: value }));
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.category.trim() || !newChecklistItem.text.trim()) {
      toast.error('카테고리와 항목명을 입력해주세요.');
      return;
    }

    const newItem: ChecklistTemplate = {
      id: Math.max(0, ...checklistTemplate.map((item) => item.id)) + 1,
      category: newChecklistItem.category.trim(),
      text: newChecklistItem.text.trim(),
    };

    if (newChecklistItem.inputType === 'text' && newChecklistItem.inputLabel.trim()) {
      newItem.input = { type: 'text', label: newChecklistItem.inputLabel.trim() };
    }
    if (newChecklistItem.inputType === 'radio' && newChecklistItem.inputLabel.trim() && newChecklistItem.radioOptions.trim()) {
      newItem.input = {
        type: 'radio',
        label: newChecklistItem.inputLabel.trim(),
        options: newChecklistItem.radioOptions.split(',').map((option) => option.trim()).filter(Boolean),
      };
    }

    setChecklistTemplate((prev) => [...prev, newItem]);
    setNewChecklistItem(INITIAL_CHECKLIST_ITEM);
    setAddChecklistModalOpen(false);
    toast.success('항목이 추가되었습니다.');
  };

  const removeChecklistItem = (id: number) => {
    setChecklistTemplate((prev) => prev.filter((item) => item.id !== id));
  };

  const saveChecklist = async () => {
    setSavingChecklist(true);
    try {
      await updateConsultationSettings({
        ...settings,
        checklist_template: checklistTemplate,
      } as ConsultationSettingsPatch, SUPPRESS_API_ERROR_TOAST);
      toast.success('체크리스트가 저장되었습니다.');
    } catch {
      toast.error('체크리스트를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSavingChecklist(false);
    }
  };

  const resetToDefaultChecklist = () => {
    setChecklistTemplate(DEFAULT_CHECKLIST_TEMPLATE);
    toast.success('기본 체크리스트로 초기화되었습니다.');
  };

  const copyLink = () => {
    const url = `${window.location.origin}/c/${slug}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('링크가 복사되었습니다.');
  };

  return {
    loading,
    saving,
    loadError,
    academyName,
    slug,
    originalSlug,
    slugAvailable,
    checkingSlug,
    savingSlug,
    settings,
    weeklyHours,
    hasSavedWeeklyHours,
    blockedSlots,
    blockModalOpen,
    newBlockedDate,
    newBlockReason,
    addingBlock,
    newReferralSource,
    checklistTemplate,
    checklistCategories,
    newChecklistItem,
    addChecklistModalOpen,
    savingChecklist,
    copied,
    defaultStartTime,
    defaultEndTime,
    addingHolidays,
    timeOptions: TIME_OPTIONS,
    setBlockModalOpen,
    setNewBlockedDate,
    setNewBlockReason,
    setNewReferralSource,
    setAddChecklistModalOpen,
    setDefaultStartTime,
    setDefaultEndTime,
    setSlugValue,
    updateSetting,
    checkSlug,
    handleSaveSlug,
    handleSaveSettings,
    handleSaveWeeklyHours,
    handleAddBlockedSlot,
    handleRemoveBlockedSlot,
    handleAddAllHolidays,
    updateHour,
    applyDefaultTimeToAll,
    applyDefaultTimeToWeekdays,
    addReferralSource,
    removeReferralSource,
    updateNewChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    saveChecklist,
    resetToDefaultChecklist,
    copyLink,
  };
}

import type { ConsultationButton, NotificationSettings } from '@/lib/api/notifications';

export type NotificationButtonField =
  | 'solapi_buttons'
  | 'solapi_consultation_buttons'
  | 'solapi_trial_buttons'
  | 'solapi_overdue_buttons'
  | 'solapi_reminder_buttons'
  | 'sens_buttons'
  | 'sens_consultation_buttons'
  | 'sens_trial_buttons'
  | 'sens_overdue_buttons'
  | 'sens_reminder_buttons';

function createNotificationButton(): ConsultationButton {
  return { buttonType: 'WL', buttonName: '', linkMo: '', linkPc: '' };
}

function getButtons(settings: NotificationSettings, field: NotificationButtonField): ConsultationButton[] {
  const buttons = settings[field];
  return Array.isArray(buttons) ? buttons : [];
}

export function appendNotificationButton(
  settings: NotificationSettings,
  field: NotificationButtonField
): NotificationSettings {
  return {
    ...settings,
    [field]: [...getButtons(settings, field), createNotificationButton()],
  } as NotificationSettings;
}

export function removeNotificationButton(
  settings: NotificationSettings,
  field: NotificationButtonField,
  index: number
): NotificationSettings {
  return {
    ...settings,
    [field]: getButtons(settings, field).filter((_, i) => i !== index),
  } as NotificationSettings;
}

export function updateNotificationButton(
  settings: NotificationSettings,
  field: NotificationButtonField,
  index: number,
  buttonField: keyof ConsultationButton,
  value: string
): NotificationSettings {
  return {
    ...settings,
    [field]: getButtons(settings, field).map((button, i) => (
      i === index ? { ...button, [buttonField]: value } : button
    )),
  } as NotificationSettings;
}

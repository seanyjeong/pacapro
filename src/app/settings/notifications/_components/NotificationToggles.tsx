'use client';

// Phase 4 #1 — 알림톡 발송 설정 (마스터 토글 + 개별 토글) sub-component
import { Bell, DollarSign, AlertCircle, GraduationCap, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { NotificationSettings } from '@/lib/api/notifications';

interface Props {
  settings: NotificationSettings;
  setSettings: React.Dispatch<React.SetStateAction<NotificationSettings>>;
  showSolapiSettingsSection: boolean;
  setShowSolapiSettingsSection: (v: boolean) => void;
  saving: boolean;
  onSave: () => void;
}

export default function NotificationToggles({
  settings,
  setSettings,
  showSolapiSettingsSection,
  setShowSolapiSettingsSection,
  saving,
  onSave,
}: Props) {
  const isEnabled = settings.service_type === 'solapi' ? settings.solapi_enabled : settings.is_enabled;

  return (
    <div className="bg-card rounded-lg shadow-sm border border-purple-200 dark:border-purple-800">
      <button
        onClick={() => setShowSolapiSettingsSection(!showSolapiSettingsSection)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-purple-600" />
          <span className="font-semibold text-foreground">알림톡 발송 설정</span>
          {isEnabled && (
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">활성화됨</span>
          )}
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {settings.service_type === 'solapi' ? '솔라피' : 'SENS'}
          </span>
        </div>
        {showSolapiSettingsSection ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {showSolapiSettingsSection && (
        <div className="border-t border-border p-6">
          <div className="space-y-4">
            {/* 마스터 토글 */}
            <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
              <div>
                <p className="font-medium text-purple-900 dark:text-purple-100">알림톡 전체 활성화</p>
                <p className="text-sm text-purple-700 dark:text-purple-300">모든 알림톡 발송 기능을 제어합니다</p>
              </div>
              <button
                onClick={() => {
                  if (settings.service_type === 'solapi') {
                    setSettings(prev => ({ ...prev, solapi_enabled: !prev.solapi_enabled }));
                  } else {
                    setSettings(prev => ({ ...prev, is_enabled: !prev.is_enabled }));
                  }
                }}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${isEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* 개별 알림톡 토글들 */}
            {isEnabled && (
              <div className="space-y-3">
                {/* 납부 안내 + 미납자 (같은 시간) */}
                <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      <span className="font-medium text-orange-900 dark:text-orange-100">납부 안내</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={settings.service_type === 'solapi' ? (settings.solapi_auto_hour ?? 10) : (settings.sens_auto_hour ?? 10)}
                        onChange={e => {
                          const hour = parseInt(e.target.value);
                          if (settings.service_type === 'solapi') {
                            setSettings(prev => ({ ...prev, solapi_auto_hour: hour }));
                          } else {
                            setSettings(prev => ({ ...prev, sens_auto_hour: hour }));
                          }
                        }}
                        disabled={settings.service_type === 'solapi' ? !settings.solapi_auto_enabled : !settings.sens_auto_enabled}
                        className="px-2 py-1 text-sm border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-foreground rounded focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                      >
                        {[...Array(24)].map((_, hour) => (
                          <option key={hour} value={hour}>{hour.toString().padStart(2, '0')}시</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (settings.service_type === 'solapi') {
                            setSettings(prev => ({ ...prev, solapi_auto_enabled: !prev.solapi_auto_enabled }));
                          } else {
                            setSettings(prev => ({ ...prev, sens_auto_enabled: !prev.sens_auto_enabled }));
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          (settings.service_type === 'solapi' ? settings.solapi_auto_enabled : settings.sens_auto_enabled)
                            ? 'bg-orange-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          (settings.service_type === 'solapi' ? settings.solapi_auto_enabled : settings.sens_auto_enabled)
                            ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <span className="font-medium text-red-900 dark:text-red-100">미납자</span>
                      <span className="text-xs text-muted-foreground">(동일 시간)</span>
                    </div>
                    <button
                      onClick={() => {
                        if (settings.service_type === 'solapi') {
                          setSettings(prev => ({ ...prev, solapi_overdue_auto_enabled: !prev.solapi_overdue_auto_enabled }));
                        } else {
                          setSettings(prev => ({ ...prev, sens_overdue_auto_enabled: !prev.sens_overdue_auto_enabled }));
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        (settings.service_type === 'solapi' ? settings.solapi_overdue_auto_enabled : settings.sens_overdue_auto_enabled)
                          ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        (settings.service_type === 'solapi' ? settings.solapi_overdue_auto_enabled : settings.sens_overdue_auto_enabled)
                          ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 상담확정 — 항상 ON */}
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="font-medium text-green-900 dark:text-green-100">상담확정</span>
                    </div>
                    <span className="text-xs px-2 py-1 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 rounded">항상 ON</span>
                  </div>

                  {/* 체험수업 */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium text-blue-900 dark:text-blue-100">체험수업</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={settings.service_type === 'solapi' ? (settings.solapi_trial_auto_hour ?? 9) : (settings.sens_trial_auto_hour ?? 9)}
                        onChange={e => {
                          const hour = parseInt(e.target.value);
                          if (settings.service_type === 'solapi') {
                            setSettings(prev => ({ ...prev, solapi_trial_auto_hour: hour }));
                          } else {
                            setSettings(prev => ({ ...prev, sens_trial_auto_hour: hour }));
                          }
                        }}
                        disabled={settings.service_type === 'solapi' ? !settings.solapi_trial_auto_enabled : !settings.sens_trial_auto_enabled}
                        className="px-2 py-1 text-sm border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 text-foreground rounded focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {[...Array(24)].map((_, hour) => (
                          <option key={hour} value={hour}>{hour.toString().padStart(2, '0')}시</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (settings.service_type === 'solapi') {
                            setSettings(prev => ({ ...prev, solapi_trial_auto_enabled: !prev.solapi_trial_auto_enabled }));
                          } else {
                            setSettings(prev => ({ ...prev, sens_trial_auto_enabled: !prev.sens_trial_auto_enabled }));
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          (settings.service_type === 'solapi' ? settings.solapi_trial_auto_enabled : settings.sens_trial_auto_enabled)
                            ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          (settings.service_type === 'solapi' ? settings.solapi_trial_auto_enabled : settings.sens_trial_auto_enabled)
                            ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* 상담 리마인드 */}
                  <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="font-medium text-purple-900 dark:text-purple-100">상담 리마인드</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={settings.service_type === 'solapi' ? (settings.solapi_reminder_hours ?? 1) : (settings.sens_reminder_hours ?? 1)}
                        onChange={e => {
                          const hours = parseInt(e.target.value);
                          if (settings.service_type === 'solapi') {
                            setSettings(prev => ({ ...prev, solapi_reminder_hours: hours }));
                          } else {
                            setSettings(prev => ({ ...prev, sens_reminder_hours: hours }));
                          }
                        }}
                        disabled={settings.service_type === 'solapi' ? !settings.solapi_reminder_auto_enabled : !settings.sens_reminder_auto_enabled}
                        className="px-2 py-1 text-sm border border-purple-300 dark:border-purple-700 bg-white dark:bg-gray-800 text-foreground rounded focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                      >
                        <option value={1}>1시간 전</option>
                        <option value={2}>2시간 전</option>
                        <option value={3}>3시간 전</option>
                        <option value={6}>6시간 전</option>
                        <option value={12}>12시간 전</option>
                        <option value={24}>24시간 전</option>
                      </select>
                      <button
                        onClick={() => {
                          if (settings.service_type === 'solapi') {
                            setSettings(prev => ({ ...prev, solapi_reminder_auto_enabled: !prev.solapi_reminder_auto_enabled }));
                          } else {
                            setSettings(prev => ({ ...prev, sens_reminder_auto_enabled: !prev.sens_reminder_auto_enabled }));
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          (settings.service_type === 'solapi' ? settings.solapi_reminder_auto_enabled : settings.sens_reminder_auto_enabled)
                            ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          (settings.service_type === 'solapi' ? settings.solapi_reminder_auto_enabled : settings.sens_reminder_auto_enabled)
                            ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isEnabled && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  알림톡이 비활성화되어 있습니다. 활성화해야 모든 알림톡을 발송할 수 있습니다.
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <button
                onClick={onSave}
                disabled={saving}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? '저장 중...' : '발송 설정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
